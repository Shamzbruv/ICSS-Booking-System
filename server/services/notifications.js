/**
 * Notifications — in-app inbox + Web Push for business owners and staff.
 *
 *  notify(tenantId, event)        Fan out one event to every active admin/staff
 *                                 user of the tenant (minus the person who did it),
 *                                 store it in their inbox, then push it to each of
 *                                 their devices (phones with the admin app installed,
 *                                 desktop browsers) unless they muted that event type
 *                                 or it is inside their quiet hours.
 *
 * Push keys (VAPID) come from VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY when set,
 * otherwise they are generated once and stored encrypted in the database so
 * push works on Railway with zero configuration.
 *
 * Every entry point is fire-and-forget safe: a notification failure must never
 * break a booking, a payment or a status change.
 */

const webpush = require('web-push');
const { query } = require('../db/connection');

// type → label shown in Settings, default on/off, push urgency
const NOTIFICATION_TYPES = {
    booking_new:          { label: 'New bookings', group: 'Bookings', default: true, urgency: 'high' },
    booking_payment:      { label: 'Payments to review or verify', group: 'Payments', default: true, urgency: 'high' },
    booking_after_hours:  { label: 'After-hours requests', group: 'Bookings', default: true, urgency: 'high' },
    booking_cancelled:    { label: 'Cancellations & rejections', group: 'Bookings', default: true, urgency: 'normal' },
    booking_updated:      { label: 'Changes made by your team', group: 'Team activity', default: true, urgency: 'low' },
    booking_expired:      { label: 'Unpaid holds that expired', group: 'Payments', default: true, urgency: 'normal' },
    appointment_reminder: { label: 'Appointment starting soon (30 min)', group: 'Schedule', default: true, urgency: 'high' },
    daily_summary:        { label: 'Morning agenda (7:00 am)', group: 'Schedule', default: true, urgency: 'normal' },
    billing:              { label: 'Subscription & billing', group: 'Account', default: true, urgency: 'normal' },
    system:               { label: 'Tests & system messages', group: 'Account', default: true, urgency: 'normal' }
};

const STAFF_ROLES = ['tenant_admin', 'staff'];
const MAX_TITLE = 120;
const MAX_BODY = 400;

let pushReady = null; // Promise<{ publicKey } | null>

// ── Push keys ────────────────────────────────────────────────────────────────
async function loadVapidKeys() {
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
        return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
    }
    const { encrypt, decrypt } = require('./encryption');
    const existing = await query(`SELECT key, value FROM app_secrets WHERE key IN ('vapid_public_key','vapid_private_key')`);
    const map = Object.fromEntries(existing.rows.map((row) => [row.key, row.value]));
    if (map.vapid_public_key && map.vapid_private_key) {
        return { publicKey: map.vapid_public_key, privateKey: decrypt(map.vapid_private_key) };
    }
    const keys = webpush.generateVAPIDKeys();
    // ON CONFLICT DO NOTHING + re-read keeps multiple instances booting at once consistent.
    await query(`INSERT INTO app_secrets (key, value) VALUES ('vapid_public_key', $1), ('vapid_private_key', $2) ON CONFLICT (key) DO NOTHING`,
        [keys.publicKey, encrypt(keys.privateKey)]);
    const stored = await query(`SELECT key, value FROM app_secrets WHERE key IN ('vapid_public_key','vapid_private_key')`);
    const saved = Object.fromEntries(stored.rows.map((row) => [row.key, row.value]));
    return { publicKey: saved.vapid_public_key, privateKey: decrypt(saved.vapid_private_key) };
}

function initPush() {
    if (!pushReady) {
        pushReady = loadVapidKeys()
            .then((keys) => {
                const subject = process.env.VAPID_SUBJECT || `mailto:${process.env.ADMIN_EMAIL || 'support@icssbookings.com'}`;
                webpush.setVapidDetails(subject.startsWith('mailto:') || subject.startsWith('https:') ? subject : `mailto:${subject}`, keys.publicKey, keys.privateKey);
                return { publicKey: keys.publicKey };
            })
            .catch((err) => {
                console.error('[Notifications] Push unavailable:', err.message);
                pushReady = null;
                return null;
            });
    }
    return pushReady;
}

async function getPublicKey() {
    const ready = await initPush();
    return ready ? ready.publicKey : null;
}

// ── Preferences ──────────────────────────────────────────────────────────────
function normalizePrefs(raw = {}) {
    const types = {};
    for (const [type, def] of Object.entries(NOTIFICATION_TYPES)) {
        types[type] = raw.types && typeof raw.types[type] === 'boolean' ? raw.types[type] : def.default;
    }
    const quiet = raw.quietHours || {};
    const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
    return {
        push: raw.push !== false,
        sound: raw.sound !== false,
        types,
        quietHours: {
            enabled: Boolean(quiet.enabled),
            start: timePattern.test(quiet.start || '') ? quiet.start : '22:00',
            end: timePattern.test(quiet.end || '') ? quiet.end : '07:00'
        }
    };
}

function minutesInZone(timeZone, date = new Date()) {
    try {
        const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
        const h = Number(parts.find((p) => p.type === 'hour').value);
        const m = Number(parts.find((p) => p.type === 'minute').value);
        return h * 60 + m;
    } catch {
        return date.getUTCHours() * 60 + date.getUTCMinutes();
    }
}

function isQuietNow(prefs, timeZone, date = new Date()) {
    if (!prefs.quietHours.enabled) return false;
    const toMin = (text) => Number(text.slice(0, 2)) * 60 + Number(text.slice(3, 5));
    const now = minutesInZone(timeZone, date);
    const start = toMin(prefs.quietHours.start);
    const end = toMin(prefs.quietHours.end);
    if (start === end) return false;
    return start < end ? now >= start && now < end : now >= start || now < end;
}

// ── Core ─────────────────────────────────────────────────────────────────────
function clean(text, max) {
    return String(text || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function safeUrl(url) {
    const value = String(url || '/admin/index.html');
    return value.startsWith('/admin/') ? value : '/admin/index.html';
}

async function sendPushToUser(user, notification, unreadCount) {
    const ready = await initPush();
    if (!ready) return { sent: 0, removed: 0 };
    const subs = await query(`SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`, [user.id]);
    const def = NOTIFICATION_TYPES[notification.type] || NOTIFICATION_TYPES.system;
    const payload = JSON.stringify({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        url: notification.url,
        tag: notification.tag || notification.type,
        badgeCount: unreadCount,
        silent: user.prefs.sound === false,
        requireInteraction: def.urgency === 'high',
        timestamp: Date.now()
    });
    let sent = 0;
    let removed = 0;
    await Promise.all(subs.rows.map(async (sub) => {
        try {
            await webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                payload,
                { TTL: 60 * 60 * 24, urgency: def.urgency, topic: String(notification.tag || notification.type).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || undefined }
            );
            sent += 1;
            await query(`UPDATE push_subscriptions SET last_used_at = NOW(), failure_count = 0 WHERE id = $1`, [sub.id]);
        } catch (err) {
            // 404/410: the browser unsubscribed or the app was removed — forget this device.
            if (err.statusCode === 404 || err.statusCode === 410) {
                removed += 1;
                await query(`DELETE FROM push_subscriptions WHERE id = $1`, [sub.id]);
            } else {
                await query(`UPDATE push_subscriptions SET failure_count = failure_count + 1 WHERE id = $1`, [sub.id]);
                await query(`DELETE FROM push_subscriptions WHERE id = $1 AND failure_count >= 15`, [sub.id]);
                console.warn('[Notifications] Push failed:', err.statusCode || '', err.body || err.message);
            }
        }
    }));
    return { sent, removed };
}

/**
 * Deliver one event to a tenant's team.
 * event: { type, title, body, url, bookingId, excludeUserId, onlyUserId, tag }
 */
async function notify(tenantId, event) {
    if (!tenantId || !event || !event.title) return { delivered: 0 };
    const type = NOTIFICATION_TYPES[event.type] ? event.type : 'system';
    const tenantRes = await query(`SELECT branding FROM tenants WHERE id = $1`, [tenantId]);
    const timeZone = tenantRes.rows[0]?.branding?.timezone || 'America/Jamaica';

    const usersRes = await query(
        `SELECT id, notification_prefs FROM users
         WHERE tenant_id = $1 AND role = ANY($2) AND COALESCE(active, true) = true
           AND ($3::uuid IS NULL OR id <> $3::uuid) AND ($4::uuid IS NULL OR id = $4::uuid)`,
        [tenantId, STAFF_ROLES, event.excludeUserId || null, event.onlyUserId || null]
    );

    let delivered = 0;
    for (const row of usersRes.rows) {
        const prefs = normalizePrefs(row.notification_prefs || {});
        if (prefs.types[type] === false) continue;
        const inserted = await query(
            `INSERT INTO notifications (tenant_id, user_id, type, title, body, url, booking_id, tag)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, type, title, body, url, tag`,
            [tenantId, row.id, type, clean(event.title, MAX_TITLE), clean(event.body, MAX_BODY), safeUrl(event.url), event.bookingId || null, event.tag || null]
        );
        delivered += 1;
        if (!prefs.push || isQuietNow(prefs, timeZone)) continue;
        const unread = await query(`SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL`, [row.id]);
        await sendPushToUser({ id: row.id, prefs }, inserted.rows[0], unread.rows[0].n);
    }
    return { delivered };
}

/** Fire-and-forget wrapper used by routes and workers. */
function notifySafe(tenantId, event) {
    notify(tenantId, event).catch((err) => console.error('[Notifications]', event?.type, err.message));
}

// ── Booking helpers ──────────────────────────────────────────────────────────
function describeWhen(booking, timeZone = 'America/Jamaica') {
    try {
        if (booking.start_time) {
            return new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(booking.start_time));
        }
    } catch { /* fall through */ }
    const date = String(booking.booking_date || '').slice(0, 10);
    const time = String(booking.booking_time || '').slice(0, 5);
    return [date, time].filter(Boolean).join(' at ');
}

function bookingUrl(booking) {
    return `/admin/bookings.html?focus=${encodeURIComponent(booking.id)}`;
}

/** Map a newly created booking to the right notification. */
function notifyNewBooking(tenant, booking, serviceName, { actorUserId } = {}) {
    const tz = tenant?.branding?.timezone || 'America/Jamaica';
    const when = describeWhen(booking, tz);
    const who = booking.name || 'A customer';
    const what = serviceName ? ` · ${serviceName}` : '';
    const map = {
        confirmed: { type: 'booking_new', title: `New booking: ${who}`, body: `${when}${what}` },
        pending_manual_confirmation: { type: 'booking_payment', title: `Payment to review: ${who}`, body: `${when}${what} — receipt uploaded, approve it to confirm.` },
        pending_payment: { type: 'booking_payment', title: `Awaiting payment: ${who}`, body: `${when}${what} — verify the payment when it arrives.` },
        pending_after_hours_confirmation: { type: 'booking_after_hours', title: `After-hours request: ${who}`, body: `${when}${what} — approve or decline.` }
    };
    const entry = map[booking.status] || map.confirmed;
    notifySafe(tenant.id, { ...entry, url: bookingUrl(booking), bookingId: booking.id, tag: `booking-${booking.id}`, excludeUserId: actorUserId || null });
}

/** Notify the rest of the team when someone changes a booking. */
function notifyBookingStatusChange(tenant, booking, status, { actorUserId, actorName } = {}) {
    const tz = tenant?.branding?.timezone || 'America/Jamaica';
    const when = describeWhen(booking, tz);
    const who = booking.name || 'Customer';
    const by = actorName ? ` by ${actorName}` : '';
    const labels = { confirmed: 'Confirmed', completed: 'Completed', no_show: 'Marked no-show', cancelled: 'Cancelled', rejected: 'Rejected' };
    const type = ['cancelled', 'rejected'].includes(status) ? 'booking_cancelled' : 'booking_updated';
    notifySafe(tenant.id, {
        type,
        title: `${labels[status] || 'Updated'}: ${who}`,
        body: `${when}${by}`,
        url: bookingUrl(booking),
        bookingId: booking.id,
        tag: `booking-${booking.id}`,
        excludeUserId: actorUserId || null
    });
}

// ── Scheduled: reminders & morning agenda ────────────────────────────────────
async function runAppointmentReminders() {
    const due = await query(
        `UPDATE bookings b SET staff_reminder_sent_at = NOW()
         FROM tenants t
         WHERE b.tenant_id = t.id AND t.active = true
           AND b.status = 'confirmed' AND b.staff_reminder_sent_at IS NULL
           AND b.start_time BETWEEN NOW() + INTERVAL '20 minutes' AND NOW() + INTERVAL '35 minutes'
         RETURNING b.id, b.tenant_id, b.name, b.start_time, b.booking_date, b.booking_time, b.service_id, t.branding`
    );
    for (const booking of due.rows) {
        const svc = booking.service_id ? await query(`SELECT name FROM services WHERE id = $1`, [booking.service_id]) : { rows: [] };
        const tz = booking.branding?.timezone || 'America/Jamaica';
        const time = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(new Date(booking.start_time));
        await notify(booking.tenant_id, {
            type: 'appointment_reminder',
            title: `Up next at ${time}: ${booking.name}`,
            body: `${svc.rows[0]?.name || 'Appointment'} starts in about 30 minutes.`,
            url: bookingUrl(booking),
            bookingId: booking.id,
            tag: `reminder-${booking.id}`
        });
    }
    return due.rows.length;
}

async function runDailySummaries(now = new Date()) {
    const tenants = await query(`SELECT id, branding, daily_summary_sent_on FROM tenants WHERE active = true`);
    let sent = 0;
    for (const tenant of tenants.rows) {
        const tz = tenant.branding?.timezone || 'America/Jamaica';
        const minutes = minutesInZone(tz, now);
        if (minutes < 7 * 60 || minutes >= 7 * 60 + 30) continue; // 7:00–7:29 local
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now);
        if (tenant.daily_summary_sent_on && String(tenant.daily_summary_sent_on).slice(0, 10) === today) continue;
        const claimed = await query(
            `UPDATE tenants SET daily_summary_sent_on = $2 WHERE id = $1 AND (daily_summary_sent_on IS NULL OR daily_summary_sent_on <> $2) RETURNING id`,
            [tenant.id, today]
        );
        if (!claimed.rows.length) continue;
        const counts = await query(
            `SELECT
                COUNT(*) FILTER (WHERE status = 'confirmed')::int AS confirmed,
                COUNT(*) FILTER (WHERE status IN ('pending_payment','pending_manual_confirmation','pending_after_hours_confirmation'))::int AS pending,
                MIN(start_time) FILTER (WHERE status = 'confirmed') AS first_start
             FROM bookings WHERE tenant_id = $1 AND booking_date = $2::date`,
            [tenant.id, today]
        );
        const { confirmed, pending, first_start: firstStart } = counts.rows[0];
        if (!confirmed && !pending) continue;
        const first = firstStart ? new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(new Date(firstStart)) : null;
        await notify(tenant.id, {
            type: 'daily_summary',
            title: `Today: ${confirmed} appointment${confirmed === 1 ? '' : 's'}`,
            body: [first ? `First at ${first}.` : '', pending ? `${pending} waiting for your approval.` : ''].filter(Boolean).join(' ') || 'Have a great day!',
            url: '/admin/bookings.html',
            tag: `summary-${today}`
        });
        sent += 1;
    }
    return sent;
}

function startNotificationJobs() {
    const tick = () => {
        runAppointmentReminders().catch((err) => console.error('[Notifications] reminders:', err.message));
        runDailySummaries().catch((err) => console.error('[Notifications] daily summary:', err.message));
    };
    setTimeout(tick, 15 * 1000);
    return setInterval(tick, 5 * 60 * 1000);
}

module.exports = {
    NOTIFICATION_TYPES,
    initPush,
    getPublicKey,
    normalizePrefs,
    isQuietNow,
    minutesInZone,
    notify,
    notifySafe,
    notifyNewBooking,
    notifyBookingStatusChange,
    describeWhen,
    runAppointmentReminders,
    runDailySummaries,
    startNotificationJobs
};
