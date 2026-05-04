const express = require('express');
const router = express.Router();
const calendarSync = require('../../services/calendarSync');
const { query } = require('../../db/connection');

const { authenticate } = require('../../middleware/auth');

/**
 * 1. OAuth Connect
 * GET /api/v1/calendar/connect/:provider
 * Redirects user to Google or Microsoft OAuth consent screen.
 */
router.get('/connect/:provider', authenticate, async (req, res) => {
    try {
        const { provider } = req.params;
        const tenant_id = req.tenant?.id || req.query.tenant_id;
        const user_id = req.user?.id || req.query.user_id;
        const returnTo = typeof req.query.return_to === 'string' && req.query.return_to.startsWith('/')
            ? req.query.return_to
            : null;
        
        if (!tenant_id || !user_id) {
            return res.status(400).json({ error: 'tenant_id and user_id required' });
        }

        const authUrl = await calendarSync.generateAuthUrl(provider, tenant_id, user_id, returnTo);
        if (req.query.format === 'json') {
            return res.json({ authUrl });
        }
        res.redirect(authUrl);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * 2. OAuth Callback
 * GET /api/v1/calendar/oauth2callback/:provider
 * Handles redirect back from Provider, extracts code, and stores encrypted tokens.
 */
router.get('/oauth2callback/:provider', async (req, res) => {
    try {
        const { provider } = req.params;
        const { code, state } = req.query;

        if (!code || !state) {
            return res.status(400).json({ error: 'Missing code or state parameter' });
        }

        const connectionInfo = await calendarSync.handleCallback(provider, code, state);
        if (connectionInfo.return_to && connectionInfo.return_to.startsWith('/')) {
            return res.redirect(connectionInfo.return_to);
        }
        res.json({ message: 'Calendar sync connected successfully!', data: connectionInfo });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/status', authenticate, async (req, res) => {
    try {
        const [connectionsResult, tenantResult] = await Promise.all([
            query(
                `SELECT provider, provider_account_id, created_at, updated_at
                 FROM calendar_connections
                 WHERE tenant_id = $1
                 ORDER BY created_at ASC`,
                [req.tenant.id]
            ),
            query(`SELECT feed_token FROM tenants WHERE id = $1`, [req.tenant.id])
        ]);

        const feedToken = tenantResult.rows[0]?.feed_token || null;
        const baseUrl = process.env.PUBLIC_APP_URL || process.env.BASE_URL || `${req.headers['x-forwarded-proto'] || req.protocol}://${req.get('host')}`;
        const feedUrl = feedToken ? `${baseUrl}/api/v1/calendar/feed/${feedToken}.ics` : null;
        const feedWebcalUrl = feedUrl ? feedUrl.replace(/^https?:\/\//i, 'webcal://') : null;

        res.json({
            connections: connectionsResult.rows,
            feed_url: feedUrl,
            feed_webcal_url: feedWebcalUrl
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * 3. Apple ICS Read-Only Feed (Secure)
 * GET /api/v1/calendar/feed/:feed_token.ics
 */
router.get('/feed/:feed_token.ics', async (req, res) => {
    try {
        const { feed_token } = req.params;
        const icsData = await calendarSync.generateIcsFeed(feed_token);

        if (!icsData) return res.status(404).send('Feed not found');

        res.set({
            'Content-Type': 'text/calendar; charset=utf-8',
            'Content-Disposition': 'inline; filename="icss-bookings.ics"',
            'Cache-Control': 'private, max-age=300, must-revalidate',
            'X-Robots-Tag': 'noindex, nofollow, noarchive'
        });
        res.send(icsData);
    } catch (e) {
        res.status(500).send('Error generating calendar feed');
    }
});

/**
 * 4. Google Push Webhook Listener
 * POST /api/v1/calendar/webhook/google
 */
router.post('/webhook/google', async (req, res) => {
    try {
        const channelId = req.headers['x-goog-channel-id'];
        const resourceState = req.headers['x-goog-resource-state']; 

        if (channelId && resourceState !== 'sync') {
            await calendarSync.handleGoogleWebhook(channelId);
        }

        res.status(200).send('OK');
    } catch (e) {
        console.error(e);
        res.status(500).send('Webhook Processing Error');
    }
});

/**
 * 5. Microsoft Graph Push Webhook Listener
 * POST /api/v1/calendar/webhook/ms
 */
router.post('/webhook/ms', async (req, res) => {
    try {
        if (req.query.validationToken) {
            return res.status(200).send(req.query.validationToken);
        }

        const notifications = req.body?.value || [];
        for (const notification of notifications) {
            const subscriptionId = notification.subscriptionId;
            await calendarSync.handleMicrosoftWebhook(subscriptionId);
        }

        res.status(202).send('Accepted');
    } catch (e) {
        console.error(e);
        res.status(500).send('Webhook Processing Error');
    }
});

module.exports = router;
