const express = require('express');
const rateLimit = require('express-rate-limit');
const { canManageConsultations } = require('../../services/consultationAccess');
const { query } = require('../../db/connection');
const { authenticate, requirePlatformOwner } = require('../../middleware/auth');
const {
    HOSTS, TOPICS, DURATION, timeWindow, checkedHost, normalizeSchedule, loadHosts,
    slotsFor, nextOpenDate, createBooking, changeBooking, publicBooking, manageToken, verifyToken, fail
} = require('../../services/consultations');

const publicRouter = express.Router();
const staffRouter = express.Router();
const db = { query };
const createLimit = rateLimit({
    windowMs: 60 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false,
    message: { error: 'Too many booking attempts. Please try again later.' }
});

async function handleError(err, req, res, next) {
    if (res.headersSent) return next(err);
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error('[Consultations]', err.code || err.message);
    res.status(500).json({ error: 'Consultations are temporarily unavailable. Please try again.' });
}

function noCache(req, res, next) {
    res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });
    next();
}

publicRouter.use(noCache);
publicRouter.get('/', async (req, res) => {
    const hosts = await loadHosts(db);
    res.json({
        hosts: hosts.filter(host => host.enabled).map(host => ({ id: host.id, name: HOSTS[host.id] })),
        topics: TOPICS, duration: DURATION, ...timeWindow(), nextDate: await nextOpenDate(db, hosts)
    });
});

async function sendSlots(req, res) {
    const host = checkedHost(req.query.host || 'any', true);
    const hosts = (await loadHosts(db)).filter(item => host === 'any' || host === item.id);
    const slots = await slotsFor(db, hosts, req.query.date);
    res.json({ slots: slots.map(item => item.startsAt) });
}

publicRouter.get('/slots', sendSlots);
publicRouter.post('/', createLimit, async (req, res) => {
    const booking = await createBooking(req.body || {});
    res.status(201).json({ booking: publicBooking(booking), token: manageToken(booking.id) });
});
publicRouter.post('/manage', async (req, res) => {
    const input = req.body || {};
    const id = verifyToken(input.token);
    if (input.action) {
        const updated = await changeBooking(id, input, null);
        return res.json({ booking: publicBooking(updated) });
    }
    const { rows: [booking] } = await query('SELECT * FROM consultations WHERE id=$1', [id]);
    if (!booking) fail(404, 'Consultation not found.');
    res.json({ booking: publicBooking(booking) });
});
publicRouter.use(handleError);

staffRouter.use(noCache, authenticate, requirePlatformOwner, async (req, res, next) => {
    if (req.user.impersonation_session_id) fail(403, 'Sign in with your own developer account.');
    const { rows: [user] } = await query(`SELECT role, email FROM users WHERE id=$1 AND tenant_id IS NULL AND active IS NOT FALSE`, [req.user.id]);
    if (!canManageConsultations(user)) {
        fail(403, 'This workspace is available to the platform owner and Jemelia.');
    }
    next();
});
staffRouter.get('/', async (req, res) => {
    const { status = 'upcoming', host = 'any' } = req.query;
    checkedHost(host, true);
    if (!['upcoming', 'all', 'confirmed', 'completed', 'cancelled', 'no_show'].includes(status)) fail(400, 'Invalid status filter.');
    const page = Math.max(1, Math.min(100000, Number.parseInt(req.query.page, 10) || 1));
    const [hosts, { rows }] = await Promise.all([
        loadHosts(db),
        query(`SELECT c.*, e.status AS email_status FROM consultations c
            LEFT JOIN email_outbox e ON e.dedupe_key = 'consultation:' || c.id::text || ':' || c.version::text
            WHERE ($1='any' OR c.host_id=$1)
              AND ($2='all' OR c.status=$2 OR ($2='upcoming' AND c.status='confirmed' AND c.starts_at>=NOW()))
            ORDER BY CASE WHEN $2='upcoming' THEN c.starts_at END ASC, c.starts_at DESC, c.id
            LIMIT 26 OFFSET $3`, [host, status, (page - 1) * 25])
    ]);
    res.json({
        hosts: hosts.map(({ id, enabled, hours, blocked_dates, meeting_url }) => ({
            id, name: HOSTS[id], enabled, hours, blockedDates: blocked_dates, meetingUrl: meeting_url
        })),
        bookings: rows.slice(0, 25), hasMore: rows.length > 25, duration: DURATION, ...timeWindow()
    });
});
staffRouter.get('/slots', sendSlots);
staffRouter.put('/hosts/:id', async (req, res) => {
    const id = checkedHost(req.params.id);
    const schedule = normalizeSchedule(req.body || {});
    await query('UPDATE consultation_hosts SET enabled=$2,hours=$3,blocked_dates=$4,meeting_url=$5 WHERE id=$1',
        [id, schedule.enabled, JSON.stringify(schedule.hours), schedule.blockedDates, schedule.meetingUrl]);
    res.json({ success: true });
});
staffRouter.patch('/:id', async (req, res) => {
    const booking = await changeBooking(req.params.id, req.body || {}, req.user.id);
    res.json({ booking });
});
staffRouter.use(handleError);

module.exports = { publicRouter, staffRouter };
