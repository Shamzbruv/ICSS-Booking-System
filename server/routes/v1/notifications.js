/**
 * Notification Routes — /api/v1/notifications
 * The signed-in admin/staff user's inbox, push devices and preferences.
 */

const express = require('express');
const router = express.Router();
const { query } = require('../../db/connection');
const { authenticate } = require('../../middleware/auth');
const {
    NOTIFICATION_TYPES, getPublicKey, normalizePrefs, notify
} = require('../../services/notifications');

const STAFF_ROLES = new Set(['tenant_admin', 'staff']);

router.use(authenticate);
router.use((req, res, next) => {
    if (!req.user || !req.tenant || String(req.user.tenant_id) !== String(req.tenant.id) || !STAFF_ROLES.has(req.user.role)) {
        return res.status(403).json({ error: 'Notifications are available to business admins and staff.' });
    }
    // Support staff impersonating a business must never receive its notifications.
    if (req.user.impersonation_session_id) {
        return res.status(403).json({ error: 'Notifications are disabled while viewing a business as support.' });
    }
    next();
});

const UUID = /^[0-9a-f-]{36}$/i;

// GET /api/v1/notifications?limit=30&before=<iso>
router.get('/', async (req, res) => {
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
    const before = req.query.before && !Number.isNaN(Date.parse(req.query.before)) ? new Date(req.query.before) : null;
    try {
        const [items, unread] = await Promise.all([
            query(
                `SELECT id, type, title, body, url, booking_id, read_at, created_at FROM notifications
                 WHERE user_id = $1 AND ($2::timestamptz IS NULL OR created_at < $2)
                 ORDER BY created_at DESC LIMIT $3`,
                [req.user.id, before, limit]
            ),
            query(`SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL`, [req.user.id])
        ]);
        res.json({ notifications: items.rows, unread: unread.rows[0].n, has_more: items.rows.length === limit });
    } catch (err) {
        console.error('[Notifications/List]', err.message);
        res.status(500).json({ error: 'Failed to load notifications.' });
    }
});

// GET /api/v1/notifications/unread-count — cheap poll for the bell badge
router.get('/unread-count', async (req, res) => {
    try {
        const [unread, latest] = await Promise.all([
            query(`SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL`, [req.user.id]),
            query(`SELECT id, type, title, body, url, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`, [req.user.id])
        ]);
        res.json({ unread: unread.rows[0].n, latest: latest.rows[0] || null });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load notifications.' });
    }
});

router.post('/read-all', async (req, res) => {
    try {
        await query(`UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL`, [req.user.id]);
        res.json({ success: true, unread: 0 });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update notifications.' });
    }
});

router.post('/:id/read', async (req, res) => {
    if (!UUID.test(req.params.id)) return res.status(400).json({ error: 'Invalid notification.' });
    try {
        await query(`UPDATE notifications SET read_at = COALESCE(read_at, NOW()) WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.id]);
        const unread = await query(`SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL`, [req.user.id]);
        res.json({ success: true, unread: unread.rows[0].n });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update notification.' });
    }
});

// ── Preferences & devices ────────────────────────────────────────────────────
router.get('/preferences', async (req, res) => {
    try {
        const [user, devices, publicKey] = await Promise.all([
            query(`SELECT notification_prefs FROM users WHERE id = $1`, [req.user.id]),
            query(`SELECT id, device_label, created_at, last_used_at FROM push_subscriptions WHERE user_id = $1 ORDER BY created_at DESC`, [req.user.id]),
            getPublicKey()
        ]);
        res.json({
            preferences: normalizePrefs(user.rows[0]?.notification_prefs || {}),
            types: Object.entries(NOTIFICATION_TYPES).map(([key, def]) => ({ key, label: def.label, group: def.group })),
            devices: devices.rows,
            push_available: Boolean(publicKey),
            vapid_public_key: publicKey
        });
    } catch (err) {
        console.error('[Notifications/Prefs]', err.message);
        res.status(500).json({ error: 'Failed to load notification settings.' });
    }
});

router.put('/preferences', async (req, res) => {
    const prefs = normalizePrefs(req.body?.preferences || {});
    try {
        await query(`UPDATE users SET notification_prefs = $1 WHERE id = $2`, [JSON.stringify(prefs), req.user.id]);
        res.json({ success: true, preferences: prefs });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save notification settings.' });
    }
});

function describeDevice(userAgent = '') {
    const ua = String(userAgent);
    const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Device';
    const browser = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
    return `${os} · ${browser}`;
}

// POST /api/v1/notifications/subscriptions — register this device for push
router.post('/subscriptions', async (req, res) => {
    const sub = req.body?.subscription || {};
    const endpoint = String(sub.endpoint || '');
    const p256dh = String(sub.keys?.p256dh || '');
    const auth = String(sub.keys?.auth || '');
    let endpointUrl;
    try { endpointUrl = new URL(endpoint); } catch { endpointUrl = null; }
    if (!endpointUrl || endpointUrl.protocol !== 'https:' || endpoint.length > 1000 || !/^[A-Za-z0-9_-]{20,200}$/.test(p256dh) || !/^[A-Za-z0-9_-]{8,100}$/.test(auth)) {
        return res.status(400).json({ error: 'Invalid push subscription.' });
    }
    const label = String(req.body?.device_label || describeDevice(req.headers['user-agent'])).slice(0, 80);
    try {
        const result = await query(
            `INSERT INTO push_subscriptions (tenant_id, user_id, endpoint, p256dh, auth, device_label, user_agent)
             VALUES ($1,$2,$3,$4,$5,$6,$7)
             ON CONFLICT (endpoint) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, user_id = EXCLUDED.user_id,
                p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, device_label = EXCLUDED.device_label,
                user_agent = EXCLUDED.user_agent, failure_count = 0
             RETURNING id, device_label, created_at`,
            [req.tenant.id, req.user.id, endpoint, p256dh, auth, label, String(req.headers['user-agent'] || '').slice(0, 300)]
        );
        // Keep the device list tidy: max 10 devices per person.
        await query(
            `DELETE FROM push_subscriptions WHERE user_id = $1 AND id NOT IN (
                SELECT id FROM push_subscriptions WHERE user_id = $1 ORDER BY COALESCE(last_used_at, created_at) DESC LIMIT 10)`,
            [req.user.id]
        );
        res.status(201).json({ success: true, device: result.rows[0] });
    } catch (err) {
        console.error('[Notifications/Subscribe]', err.message);
        res.status(500).json({ error: 'Failed to turn on notifications for this device.' });
    }
});

router.delete('/subscriptions', async (req, res) => {
    const endpoint = String(req.body?.endpoint || '');
    const id = String(req.body?.id || '');
    try {
        if (UUID.test(id)) await query(`DELETE FROM push_subscriptions WHERE id = $1 AND user_id = $2`, [id, req.user.id]);
        else if (endpoint) await query(`DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2`, [endpoint, req.user.id]);
        else return res.status(400).json({ error: 'Choose a device to remove.' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to remove the device.' });
    }
});

// POST /api/v1/notifications/test — send a test to only this user
router.post('/test', async (req, res) => {
    try {
        await notify(req.tenant.id, {
            type: 'system',
            title: 'Notifications are working 🎉',
            body: 'You’ll get alerts like this for new bookings, payments and changes.',
            url: '/admin/index.html',
            onlyUserId: req.user.id,
            tag: 'test'
        });
        const devices = await query(`SELECT COUNT(*)::int AS n FROM push_subscriptions WHERE user_id = $1`, [req.user.id]);
        res.json({ success: true, devices: devices.rows[0].n });
    } catch (err) {
        console.error('[Notifications/Test]', err.message);
        res.status(500).json({ error: 'Failed to send a test notification.' });
    }
});

module.exports = router;
