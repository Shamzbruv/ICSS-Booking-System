const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const webpush = require('web-push');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

// ── In-memory stand-ins for the database and the push service ────────────────
const db = { users: [], notifications: [], subs: [], deleted: [], secrets: {} };
const sent = [];

function fakeQuery(sql, params = []) {
    const text = sql.replace(/\s+/g, ' ');
    if (text.startsWith('SELECT branding FROM tenants')) return { rows: [{ branding: { timezone: 'America/Jamaica' } }] };
    if (text.includes('FROM app_secrets')) return { rows: Object.entries(db.secrets).map(([key, value]) => ({ key, value })) };
    if (text.startsWith('INSERT INTO app_secrets')) {
        db.secrets.vapid_public_key = db.secrets.vapid_public_key || params[0];
        db.secrets.vapid_private_key = db.secrets.vapid_private_key || params[1];
        return { rows: [] };
    }
    if (text.startsWith('SELECT id, notification_prefs FROM users')) {
        const [, , exclude, only] = params;
        return { rows: db.users.filter((u) => u.id !== exclude && (!only || u.id === only)) };
    }
    if (text.startsWith('INSERT INTO notifications')) {
        const row = { id: `n${db.notifications.length + 1}`, user_id: params[1], type: params[2], title: params[3], body: params[4], url: params[5], tag: params[7] };
        db.notifications.push(row);
        return { rows: [row] };
    }
    if (text.startsWith('SELECT COUNT(*)::int AS n FROM notifications')) return { rows: [{ n: db.notifications.filter((n) => n.user_id === params[0]).length }] };
    if (text.startsWith('SELECT id, endpoint, p256dh, auth FROM push_subscriptions')) return { rows: db.subs.filter((s) => s.user_id === params[0]) };
    if (text.startsWith('DELETE FROM push_subscriptions WHERE id = $1 AND failure_count')) return { rows: [] };
    if (text.startsWith('DELETE FROM push_subscriptions WHERE id = $1')) { db.deleted.push(params[0]); return { rows: [] }; }
    if (text.startsWith('UPDATE push_subscriptions')) return { rows: [] };
    throw new Error(`Unexpected SQL in test: ${text.slice(0, 80)}`);
}

require.cache[require.resolve('../server/db/connection')] = {
    id: 'db', filename: 'db', loaded: true,
    exports: { query: async (sql, params) => fakeQuery(sql, params) }
};
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length === 64 ? process.env.ENCRYPTION_KEY : 'a'.repeat(64);
const realSend = webpush.sendNotification;
webpush.sendNotification = async (sub, payload, options) => {
    if (sub.endpoint.includes('gone')) { const err = new Error('Gone'); err.statusCode = 410; throw err; }
    sent.push({ endpoint: sub.endpoint, payload: JSON.parse(payload), options });
    return { statusCode: 201 };
};

const notifications = require('../server/services/notifications');

function reset() {
    db.users = []; db.notifications = []; db.subs = []; db.deleted = []; sent.length = 0;
}

test.after(() => { webpush.sendNotification = realSend; });

test('preferences default every alert on and validate quiet hours', () => {
    const prefs = notifications.normalizePrefs({ types: { booking_new: false }, quietHours: { enabled: true, start: '25:00', end: '06:30' } });
    assert.equal(prefs.types.booking_new, false);
    assert.equal(prefs.types.booking_payment, true);
    assert.equal(prefs.push, true);
    assert.equal(prefs.quietHours.start, '22:00', 'invalid time falls back');
    assert.equal(prefs.quietHours.end, '06:30');
});

test('quiet hours work across midnight in the business timezone', () => {
    const prefs = notifications.normalizePrefs({ quietHours: { enabled: true, start: '22:00', end: '07:00' } });
    const at = (utcHour) => { const d = new Date(Date.UTC(2026, 10, 4, utcHour, 0)); return notifications.isQuietNow(prefs, 'America/Jamaica', d); };
    assert.equal(at(4), true, '23:00 in Jamaica is quiet');
    assert.equal(at(10), true, '05:00 in Jamaica is quiet');
    assert.equal(at(14), false, '09:00 in Jamaica is not quiet');
    assert.equal(notifications.isQuietNow(notifications.normalizePrefs({}), 'America/Jamaica'), false);
});

test('a booking alert reaches the team inbox and their devices, never the actor', async () => {
    reset();
    db.users = [{ id: 'owner', notification_prefs: {} }, { id: 'staff', notification_prefs: {} }];
    db.subs = [
        { id: 's1', user_id: 'owner', endpoint: 'https://push.example/owner', p256dh: 'k', auth: 'a' },
        { id: 's2', user_id: 'staff', endpoint: 'https://push.example/staff', p256dh: 'k', auth: 'a' }
    ];
    const result = await notifications.notify('t1', { type: 'booking_new', title: 'New booking: Jo', body: 'Tue 1 PM', url: '/admin/bookings.html', excludeUserId: 'staff' });
    assert.equal(result.delivered, 1);
    assert.deepEqual(db.notifications.map((n) => n.user_id), ['owner']);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].endpoint, 'https://push.example/owner');
    assert.equal(sent[0].payload.title, 'New booking: Jo');
    assert.equal(sent[0].payload.badgeCount, 1);
    assert.equal(sent[0].options.urgency, 'high');
});

test('muted alert types are skipped and quiet hours keep alerts inbox-only', async () => {
    reset();
    db.users = [
        { id: 'muted', notification_prefs: { types: { booking_cancelled: false } } },
        { id: 'pushoff', notification_prefs: { push: false } }
    ];
    db.subs = [{ id: 's1', user_id: 'pushoff', endpoint: 'https://push.example/x', p256dh: 'k', auth: 'a' }];
    await notifications.notify('t1', { type: 'booking_cancelled', title: 'Cancelled: Jo' });
    assert.deepEqual(db.notifications.map((n) => n.user_id), ['pushoff'], 'muted user gets nothing');
    assert.equal(sent.length, 0, 'push turned off means inbox only');
});

test('devices the browser has dropped (410) are removed automatically', async () => {
    reset();
    db.users = [{ id: 'owner', notification_prefs: {} }];
    db.subs = [
        { id: 'live', user_id: 'owner', endpoint: 'https://push.example/live', p256dh: 'k', auth: 'a' },
        { id: 'dead', user_id: 'owner', endpoint: 'https://push.example/gone', p256dh: 'k', auth: 'a' }
    ];
    await notifications.notify('t1', { type: 'system', title: 'Test' });
    assert.equal(sent.length, 1);
    assert.deepEqual(db.deleted, ['dead']);
});

test('push keys are generated once and payloads encrypt for a real browser key', async () => {
    const publicKey = await notifications.getPublicKey();
    assert.match(publicKey, /^[A-Za-z0-9_-]{80,}$/);
    assert.ok(db.secrets.vapid_private_key && !db.secrets.vapid_private_key.includes(publicKey), 'private key stored encrypted');
    // A real P-256 browser subscription key pair, as Chrome/Safari would send.
    const crypto = require('node:crypto');
    const ecdh = crypto.createECDH('prime256v1');
    ecdh.generateKeys();
    const details = webpush.generateRequestDetails({
        endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
        keys: { p256dh: ecdh.getPublicKey('base64url'), auth: crypto.randomBytes(16).toString('base64url') }
    }, JSON.stringify({ title: 'Hi' }), { TTL: 60 });
    assert.equal(details.method, 'POST');
    assert.match(details.headers.Authorization, /^vapid t=.+, k=/);
    assert.ok(details.body.length > 20, 'payload is encrypted');
});

test('booking alerts read naturally', () => {
    const when = notifications.describeWhen({ start_time: '2026-11-10T18:00:00Z' }, 'America/Jamaica');
    assert.match(when, /Tue, Nov 10, 1:00 PM/);
});

// ── Wiring ───────────────────────────────────────────────────────────────────
test('booking, cancellation, expiry and billing events raise notifications', () => {
    const bookings = read('server/routes/v1/bookings.js');
    assert.match(bookings, /notifyNewBooking\(req\.tenant, result\.booking/);
    assert.match(bookings, /notifyBookingStatusChange\(req\.tenant, result, status/);
    assert.match(bookings, /notifyBookingStatusChange\(req\.tenant, booking, 'cancelled'/);
    assert.match(read('server/services/bookingWorker.js'), /type: 'booking_expired'/);
    assert.match(read('server/services/subscription.js'), /type: 'billing'/);
    assert.match(read('server/app.js'), /app\.use\('\/api\/v1\/notifications', notificationRoutes\)/);
    assert.match(read('server/app.js'), /startNotificationJobs\(\)/);
});

test('admin app shows the bell everywhere and the service worker handles pushes', () => {
    for (const page of ['index', 'bookings', 'availability', 'services', 'settings', 'customize', 'invoices']) {
        assert.match(read(`admin/${page}.html`), /js\/notifications\.js/, `${page} loads notifications`);
    }
    const sw = read('admin/sw.js');
    assert.match(sw, /addEventListener\('push'/);
    assert.match(sw, /addEventListener\('notificationclick'/);
    assert.match(sw, /startsWith\('\/admin\/'\)/, 'push links are restricted to the admin app');
    const ui = read('admin/js/notifications.js');
    assert.doesNotMatch(ui, /innerHTML/);
    assert.match(ui, /pushManager\.subscribe/);
    assert.match(read('admin/settings.html'), /id="notificationSettings"/);
    const routes = read('server/routes/v1/notifications.js');
    assert.match(routes, /impersonation_session_id/, 'support impersonation never receives alerts');
});
