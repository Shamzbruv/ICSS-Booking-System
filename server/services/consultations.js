const { createHmac, timingSafeEqual } = require('node:crypto');
const { transaction } = require('../db/connection');
const { saveEmailOutbox, dispatchEmailOutbox } = require('./emailOutbox');
const HOSTS = { shamar: 'Shamar Baker', jemelia: 'Jemelia Peart' };
const TOPICS = ['ICSS Bookings demo', 'Website or online store', 'Custom software or automation', 'Something else'];
const DURATION = 30;
const DAY = 86400000;
const HALF_HOUR = 1800000;
const JAMAICA_OFFSET = 5 * 60 * 60 * 1000;
const HORIZON = 45;
const UUID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

function fail(status, message) {
    throw Object.assign(new Error(message), { status });
}

function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const stamp = Date.parse(value + 'T00:00:00Z');
    return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === value;
}

function dayAt(time) {
    return new Date(time - JAMAICA_OFFSET).toISOString().slice(0, 10);
}

function timeWindow(now = Date.now()) {
    return { from: dayAt(now), to: dayAt(now + HORIZON * DAY) };
}

function checkedHost(id, allowAny = false) {
    if ((allowAny && id === 'any') || Object.hasOwn(HOSTS, id)) return id;
    fail(400, 'Choose an available consultant.');
}

function clean(value, length) {
    return typeof value === 'string' ? value.trim().slice(0, length) : '';
}

function normalizeIntake(input) {
    const name = clean(input.name, 100);
    const email = clean(input.email, 254).toLowerCase();
    const topic = input.topic;
    if (!name || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) fail(400, 'Enter your name and a valid email address.');
    if (!TOPICS.includes(topic)) fail(400, 'Choose what you’d like to discuss.');
    return { name, email, topic, company: clean(input.company, 120), details: clean(input.details, 1500) };
}

function normalizeSchedule(input) {
    const hours = {};
    for (let day = 0; day < 7; day++) {
        const range = input.hours?.[day];
        if (!range) continue;
        const time = /^(?:[01]\d|2[0-3]):(?:00|30)$/;
        if (!time.test(range.start) || !time.test(range.end) || range.start >= range.end) {
            fail(400, 'Choose valid start and end times in half-hour increments.');
        }
        hours[day] = { start: range.start, end: range.end };
    }
    if (input.enabled === true && !Object.keys(hours).length) fail(400, 'Add at least one day of availability before publishing.');
    const blockedDates = input.blockedDates || [];
    if (!Array.isArray(blockedDates) || blockedDates.length > 90 || blockedDates.some(date => !validDate(date))) {
        fail(400, 'Check the dates when this consultant is unavailable.');
    }
    const meetingUrl = clean(input.meetingUrl, 500);
    if (meetingUrl) {
        let url;
        try { url = new URL(meetingUrl); } catch { fail(400, 'Enter a valid HTTPS meeting link.'); }
        if (url.protocol !== 'https:' || url.username || url.password) fail(400, 'Enter a valid HTTPS meeting link.');
    }
    return { enabled: input.enabled === true, hours, blockedDates: [...new Set(blockedDates)].sort(), meetingUrl };
}

function openSlots(hosts, bookings, date, now = Date.now()) {
    const window = timeWindow(now);
    if (!validDate(date) || date < window.from || date > window.to) return [];
    const weekday = new Date(date + 'T00:00:00Z').getUTCDay();
    const busy = new Set(bookings.map(item => `${item.host_id}:${new Date(item.starts_at).getTime()}`));
    const result = new Map();
    for (const host of hosts) {
        const range = host.hours[weekday];
        if (!host.enabled || !range || host.blocked_dates.includes(date)) continue;
        const start = Date.parse(`${date}T${range.start}:00-05:00`);
        const end = Date.parse(`${date}T${range.end}:00-05:00`);
        for (let time = start; time + HALF_HOUR <= end; time += HALF_HOUR) {
            if (time < now + 2 * 3600000 || busy.has(`${host.id}:${time}`)) continue;
            if (!result.has(time)) result.set(time, []);
            result.get(time).push(host);
        }
    }
    return [...result].sort(([a], [b]) => a - b).map(([time, available]) => ({
        startsAt: new Date(time).toISOString(), available
    }));
}

async function slotsFor(client, hosts, date, excludeId = null) {
    if (!validDate(date)) fail(400, 'Choose a valid date.');
    const day = `${date}T00:00:00-05:00`;
    const busy = await client.query(`SELECT host_id, starts_at FROM consultations
        WHERE status='confirmed' AND starts_at >= $1 AND starts_at < $1::timestamptz + INTERVAL '24 hours'
          AND ($2::uuid IS NULL OR id <> $2)`, [day, excludeId]);
    return openSlots(hosts, busy.rows, date);
}

async function nextOpenDate(client, hosts, now = Date.now()) {
    const enabled = hosts.filter(host => host.enabled);
    if (!enabled.length) return null;
    const { to } = timeWindow(now);
    const busy = await client.query(`SELECT host_id, starts_at FROM consultations
        WHERE status='confirmed' AND starts_at >= $1 AND starts_at < $2::timestamptz + INTERVAL '24 hours'`,
        [new Date(now).toISOString(), `${to}T00:00:00-05:00`]);
    for (let offset = 0; offset <= HORIZON; offset++) {
        const date = dayAt(now + offset * DAY);
        if (openSlots(enabled, busy.rows, date, now).length) return date;
    }
    return null;
}

function publicBooking(row) {
    return {
        reference: row.id.slice(0, 8).toUpperCase(),
        host: HOSTS[row.host_id],
        hostId: row.host_id,
        startsAt: row.starts_at,
        status: row.status,
        name: row.client_name,
        topic: row.topic,
        meetingUrl: row.status === 'confirmed' ? row.meeting_url : ''
    };
}

function manageToken(id) {
    const signature = createHmac('sha256', process.env.JWT_SECRET || 'dev_secret_change_in_production')
        .update('consultation-manage:' + id).digest('base64url');
    return `${id}.${signature}`;
}

function verifyToken(value) {
    const id = typeof value === 'string' ? value.split('.')[0] : '';
    if (!UUID.test(id)) fail(404, 'This consultation link is invalid.');
    const expected = Buffer.from(manageToken(id));
    const actual = Buffer.from(value);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) fail(404, 'This consultation link is invalid.');
    return id;
}

async function loadHosts(client, lock = false) {
    const { rows } = await client.query(`SELECT * FROM consultation_hosts ORDER BY id ${lock ? 'FOR UPDATE' : ''}`);
    return rows;
}

async function pickSlot(client, hosts, input, excludeId) {
    const host = checkedHost(input.host, true);
    const timestamp = typeof input.startsAt === 'string' ? Date.parse(input.startsAt) : NaN;
    if (!Number.isFinite(timestamp)) fail(400, 'Choose an available time.');
    const choices = hosts.filter(item => host === 'any' || item.id === host);
    const slots = await slotsFor(client, choices, dayAt(timestamp), excludeId);
    const available = slots.find(item => item.startsAt === new Date(timestamp).toISOString())?.available;
    if (!available?.length) fail(409, 'That time is no longer available. Choose another time.');
    if (available.length === 1) return { host: available[0], startsAt: new Date(timestamp).toISOString() };
    const counts = await client.query(`SELECT host_id, COUNT(*)::int AS total FROM consultations
        WHERE status='confirmed' AND starts_at > NOW() GROUP BY host_id`);
    const booked = new Map(counts.rows.map(row => [row.host_id, row.total]));
    return { host: available.sort((a, b) => (booked.get(a.id) || 0) - (booked.get(b.id) || 0))[0], startsAt: new Date(timestamp).toISOString() };
}

async function saveNotice(client, booking) {
    return saveEmailOutbox({
        messageType: 'consultation',
        dedupeKey: `consultation:${booking.id}:${booking.version}`,
        recipient: booking.email,
        payload: { id: booking.id, version: booking.version }
    }, client);
}

async function dispatchNotice(outbox) {
    if (!outbox) return;
    await dispatchEmailOutbox(outbox.id).catch(err => console.error('[Consultations/Email queue]', err.message));
}

async function createBooking(input) {
    const intake = normalizeIntake(input);
    const result = await transaction(async client => {
        const hosts = await loadHosts(client, true);
        const { host, startsAt } = await pickSlot(client, hosts, input);
        const existing = await client.query(`SELECT id FROM consultations WHERE email=$1 AND starts_at=$2 AND status='confirmed'`, [intake.email, startsAt]);
        if (existing.rows.length) fail(409, 'You already have a consultation at this time. Use the link in your confirmation email to manage it.');
        const { rows: [booking] } = await client.query(`
            INSERT INTO consultations (host_id, starts_at, client_name, email, company, topic, details, meeting_url)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
        `, [host.id, startsAt, intake.name, intake.email, intake.company, intake.topic, intake.details, host.meeting_url]);
        return { booking, outbox: await saveNotice(client, booking) };
    });
    await dispatchNotice(result.outbox);
    return result.booking;
}

async function changeBooking(id, input, actor) {
    if (!UUID.test(id)) fail(404, 'Consultation not found.');
    const action = input.action;
    if (!['cancel', 'reschedule', ...(actor ? ['notes', 'complete', 'no_show'] : [])].includes(action)) fail(400, 'Choose a valid consultation action.');
    const result = await transaction(async client => {
        const hosts = await loadHosts(client, true);
        const { rows: [booking] } = await client.query('SELECT * FROM consultations WHERE id=$1 FOR UPDATE', [id]);
        if (!booking) fail(404, 'Consultation not found.');
        if (action === 'notes') {
            const { rows: [updated] } = await client.query(`UPDATE consultations SET staff_notes=$2, updated_at=NOW()
                WHERE id=$1 RETURNING *`, [id, clean(input.notes, 4000)]);
            return { booking: updated };
        }
        if (booking.status !== 'confirmed') fail(409, 'This consultation has already been closed.');
        const hasStarted = Date.parse(booking.starts_at) <= Date.now();
        if (!actor && hasStarted) fail(409, 'This consultation has already started.');
        if (['complete', 'no_show'].includes(action) && !hasStarted) fail(409, 'You can close out the consultation after its start time.');
        let hostId = booking.host_id;
        let startsAt = booking.starts_at;
        let meetingUrl = booking.meeting_url;
        if (action === 'reschedule') {
            const slot = await pickSlot(client, hosts, input, booking.id);
            hostId = slot.host.id;
            startsAt = slot.startsAt;
            meetingUrl = slot.host.meeting_url;
            const overlap = await client.query(`SELECT id FROM consultations
                WHERE id<>$1 AND email=$2 AND starts_at=$3 AND status='confirmed'`, [id, booking.email, startsAt]);
            if (overlap.rows.length) fail(409, 'The client already has a consultation at this time.');
            if (hostId === booking.host_id && Date.parse(startsAt) === Date.parse(booking.starts_at)) {
                fail(400, 'Choose a different time or consultant.');
            }
        }
        const status = { cancel: 'cancelled', complete: 'completed', no_show: 'no_show', reschedule: 'confirmed' }[action];
        const { rows: [updated] } = await client.query(`UPDATE consultations SET host_id=$2, starts_at=$3, meeting_url=$4,
            status=$5, version=version+1, updated_at=NOW() WHERE id=$1 RETURNING *`, [id, hostId, startsAt, meetingUrl, status]);
        const outbox = ['cancel', 'reschedule'].includes(action) ? await saveNotice(client, updated) : null;
        return { booking: updated, outbox };
    });
    await dispatchNotice(result.outbox);
    return result.booking;
}

module.exports = { HOSTS, TOPICS, DURATION, timeWindow, checkedHost, validDate, normalizeSchedule,
    loadHosts, slotsFor, nextOpenDate, createBooking, changeBooking, publicBooking, manageToken, verifyToken, fail };
