const express = require('express');
const router = express.Router();
const calendarSync = require('../../services/calendarSync');
const { query } = require('../../db/connection');
const { verifyCalendarToken, buildGoogleCalendarUrl, buildIcs, calendarDetails } = require('../../services/bookingCalendar');

const { authenticate } = require('../../middleware/auth');

function shouldForceHttps(hostname = '') {
    const normalizedHost = String(hostname || '').toLowerCase();
    return normalizedHost === 'icssbookings.com' || normalizedHost.endsWith('.icssbookings.com');
}

function normalizePublicBaseUrl(rawValue) {
    const trimmed = String(rawValue || '').trim();
    if (!trimmed) return '';

    const withProtocol = /^https?:\/\//i.test(trimmed)
        ? trimmed
        : `https://${trimmed.replace(/^\/+/, '')}`;

    try {
        const parsed = new URL(withProtocol);
        if (shouldForceHttps(parsed.hostname)) {
            parsed.protocol = 'https:';
        }
        return parsed.origin;
    } catch {
        return withProtocol.replace(/\/+$/, '');
    }
}

function toCalendarSubscriptionUrl(feedUrl) {
    const normalizedFeedUrl = String(feedUrl || '').trim();
    if (!normalizedFeedUrl) return '';
    return normalizedFeedUrl.replace(/^https?:\/\//i, 'webcal://');
}

function resolvePublicBaseUrl(req) {
    const configuredBaseUrl = normalizePublicBaseUrl(process.env.PUBLIC_APP_URL || process.env.BASE_URL);
    if (configuredBaseUrl) return configuredBaseUrl;

    const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
    const requestBaseUrl = normalizePublicBaseUrl(`${forwardedProto || req.protocol}://${req.get('host')}`);
    if (requestBaseUrl) return requestBaseUrl;

    return `https://${req.get('host')}`;
}

async function getPublicBooking(req, res) {
    if (!verifyCalendarToken(req.params.bookingId, req.query.token)) {
        res.status(404).send('Calendar link not found.');
        return null;
    }
    const result = await query(
        `SELECT b.*,t.name AS tenant_name,t.branding->>'location' AS tenant_location,s.name AS service_name,s.duration_minutes
         FROM bookings b JOIN tenants t ON t.id=b.tenant_id LEFT JOIN services s ON s.id=b.service_id
         WHERE b.id=$1 AND b.status IN ('confirmed','completed')`,
        [req.params.bookingId]
    );
    if (!result.rows[0]) {
        res.status(404).send('This confirmed booking is no longer available.');
        return null;
    }
    return result.rows[0];
}

function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
}

router.get('/booking/:bookingId/view', async (req, res) => {
    try {
        const booking = await getPublicBooking(req, res);
        if (!booking) return;
        const item = calendarDetails(booking);
        const googleUrl = buildGoogleCalendarUrl(booking);
        const icsUrl = `${resolvePublicBaseUrl(req)}/api/v1/calendar/booking/${booking.id}.ics?token=${encodeURIComponent(req.query.token)}`;
        res.set('Cache-Control', 'private, no-store');
        res.send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Add appointment to calendar</title><style>body{margin:0;background:#f4f1ff;color:#171525;font-family:Inter,Arial,sans-serif}.card{max-width:560px;margin:8vh auto;background:#fff;border-radius:22px;padding:34px;box-shadow:0 18px 60px #2f246522}.eyebrow{color:#6d5ce8;font-weight:800;letter-spacing:.12em;text-transform:uppercase;font-size:12px}h1{font-size:32px;margin:10px 0}.details{background:#f8f7fc;border:1px solid #e6e2f3;border-radius:14px;padding:18px;margin:24px 0;line-height:1.75}.btn{display:block;text-align:center;text-decoration:none;padding:15px 18px;border-radius:12px;font-weight:800;margin-top:12px}.primary{background:#6d5ce8;color:#fff}.secondary{border:1px solid #6d5ce8;color:#5948d4}@media(max-width:650px){.card{margin:0;min-height:100vh;border-radius:0;padding:28px 22px}}</style></head><body><main class="card"><div class="eyebrow">Booking confirmed</div><h1>Add to your calendar</h1><div class="details"><strong>${escapeHtml(item.service)}</strong><br>${escapeHtml(item.business)}<br>${escapeHtml(String(booking.booking_date).slice(0,10))} at ${escapeHtml(String(booking.booking_time).slice(0,5))}<br>${escapeHtml(item.location)}</div><a class="btn primary" href="${escapeHtml(googleUrl)}">Add to Google Calendar</a><a class="btn secondary" href="${escapeHtml(icsUrl)}">Apple, Outlook or another calendar</a></main></body></html>`);
    } catch (err) {
        console.error('[Calendar/PublicBooking]', err.message);
        res.status(500).send('Could not open this calendar link.');
    }
});

router.get('/booking/:bookingId.ics', async (req, res) => {
    try {
        const booking = await getPublicBooking(req, res);
        if (!booking) return;
        res.set({ 'Content-Type':'text/calendar; charset=utf-8', 'Content-Disposition':`attachment; filename="appointment-${booking.id}.ics"`, 'Cache-Control':'private, no-store' });
        res.send(buildIcs(booking));
    } catch (err) {
        console.error('[Calendar/PublicBookingIcs]', err.message);
        res.status(500).send('Could not create this calendar file.');
    }
});

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
        const baseUrl = resolvePublicBaseUrl(req);
        const feedUrl = feedToken ? `${baseUrl}/api/v1/calendar/feed/${feedToken}.ics` : null;
        const feedWebcalUrl = feedUrl ? toCalendarSubscriptionUrl(feedUrl) : null;

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
