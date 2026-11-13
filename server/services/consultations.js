const { createHmac, timingSafeEqual } = require('node:crypto');
const { transaction } = require('../db/connection');
const { buildFollowUp } = require('./consultationFollowUp');
const { canManageConsultations } = require('./consultationAccess');
const { saveEmailOutbox, dispatchEmailOutbox } = require('./emailOutbox');
const HOSTS = { shamar: 'Shamar Baker', jemelia: 'Jemelia Peart' };
const HOST_ROLES = { shamar: 'Founder', jemelia: 'Marketing Manager (Partner)' };
const JOINT_LABEL = 'Shamar Baker and Jemelia Peart';
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

function checkedHost(id, allowGroup = false) {
    if (typeof id === 'string' && ((allowGroup && ['any', 'both'].includes(id)) || Object.hasOwn(HOSTS, id))) return id;
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
    const busy = new Set(bookings.flatMap(item => {
        const time = new Date(item.starts_at).getTime();
        const hostIds = item.joint ? Object.keys(HOSTS) : [item.host_id];
        return hostIds.map(id => `${id}:${time}`);
    }));
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

async function slotsFor(client, hosts, date, hostChoice, excludeId = null) {
    if (!validDate(date)) fail(400, 'Choose a valid date.');
    const day = `${date}T00:00:00-05:00`;
    const busy = await client.query(`SELECT host_id, starts_at, joint FROM consultations
        WHERE status IN ('pending','confirmed') AND starts_at >= $1 AND starts_at < $1::timestamptz + INTERVAL '24 hours'
          AND ($2::uuid IS NULL OR id <> $2)`, [day, excludeId]);
    const choices = hosts.filter(item => hostChoice === 'any' || hostChoice === 'both' || item.id === hostChoice);
    const slots = openSlots(choices, busy.rows, date);
    return hostChoice === 'both' ? slots.filter(item => item.available.length === Object.keys(HOSTS).length) : slots;
}

async function nextOpenDate(client, hosts, now = Date.now()) {
    const enabled = hosts.filter(host => host.enabled);
    if (!enabled.length) return null;
    const { to } = timeWindow(now);
    const busy = await client.query(`SELECT host_id, starts_at, joint FROM consultations
        WHERE status IN ('pending','confirmed') AND starts_at >= $1 AND starts_at < $2::timestamptz + INTERVAL '24 hours'`,
        [new Date(now).toISOString(), `${to}T00:00:00-05:00`]);
    for (let offset = 0; offset <= HORIZON; offset++) {
        const date = dayAt(now + offset * DAY);
        if (openSlots(enabled, busy.rows, date, now).length) return date;
    }
    return null;
}

function consultationHostName(row) {
    return row.joint ? JOINT_LABEL : HOSTS[row.host_id];
}

function publicBooking(row) {
    return {
        reference: row.id.slice(0, 8).toUpperCase(),
        host: consultationHostName(row),
        hostId: row.joint ? 'both' : row.host_id,
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
    const startsAt = new Date(timestamp).toISOString();
    const slots = await slotsFor(client, hosts, dayAt(timestamp), host, excludeId);
    const available = slots.find(item => item.startsAt === startsAt)?.available;
    if (!available?.length) fail(409, 'That time is no longer available. Choose another time.');
    if (host === 'both') {
        const shamar = available.find(item => item.id === 'shamar');
        const jemelia = available.find(item => item.id === 'jemelia');
        return { hostId: shamar.id, joint: true, startsAt, meetingUrl: shamar.meeting_url || jemelia.meeting_url };
    }
    let selected = available[0];
    if (available.length > 1) {
        const counts = await client.query(`SELECT host_id, joint, COUNT(*)::int AS total FROM consultations
            WHERE status IN ('pending','confirmed') AND starts_at > NOW() GROUP BY host_id, joint`);
        const booked = new Map(counts.rows.filter(row => !row.joint).map(row => [row.host_id, row.total]));
        selected = available.sort((a, b) => (booked.get(a.id) || 0) - (booked.get(b.id) || 0))[0];
    }
    return { hostId: selected.id, joint: false, startsAt, meetingUrl: selected.meeting_url };
}

async function saveNotice(client, booking, action, followUp) {
    return saveEmailOutbox({
        messageType: 'consultation',
        dedupeKey: `consultation:${booking.id}:${booking.version}`,
        recipient: booking.email,
        payload: { id: booking.id, version: booking.version, action, ...(followUp ? { followUp } : {}) }
    }, client);
}

async function saveRequestNotices(client, booking) {
    const { rows } = await client.query(`SELECT role,email FROM users
        WHERE tenant_id IS NULL AND active IS TRUE AND role IN ('platform_owner','developer_admin')`);
    const recipients = new Set(rows.filter(canManageConsultations).map(user => user.email.trim().toLowerCase()));
    const notices = [];
    for (const recipient of recipients) {
        notices.push(await saveEmailOutbox({
            messageType: 'consultation_request',
            dedupeKey: `consultation_request:${booking.id}:${booking.version}:${recipient}`,
            recipient,
            payload: { id: booking.id, version: booking.version }
        }, client));
    }
    return notices;
}

async function dispatchNotice(outbox) {
    if (!outbox) return;
    await dispatchEmailOutbox(outbox.id).catch(err => console.error('[Consultations/Email queue]', err.message));
}

async function createBooking(input) {
    const intake = normalizeIntake(input);
    const result = await transaction(async client => {
        const hosts = await loadHosts(client, true);
        const { hostId, joint, startsAt } = await pickSlot(client, hosts, input);
        const existing = await client.query(`SELECT id FROM consultations WHERE email=$1 AND starts_at=$2 AND status IN ('pending','confirmed')`, [intake.email, startsAt]);
        if (existing.rows.length) fail(409, 'You already have a consultation request or booking at this time.');
        const { rows: [booking] } = await client.query(`
            INSERT INTO consultations (host_id, starts_at, client_name, email, company, topic, details, joint, status)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending') RETURNING *
        `, [hostId, startsAt, intake.name, intake.email, intake.company, intake.topic, intake.details, joint]);
        return { booking, notices: await saveRequestNotices(client, booking) };
    });
    await Promise.all(result.notices.map(dispatchNotice));
    return result.booking;
}

function googleMeetUrl(value) {
    let url;
    try { url = new URL(typeof value === 'string' ? value.trim() : ''); } catch {
        fail(400, 'Paste the Google Meet joining link to confirm this consultation.');
    }
    if (url.origin !== 'https://meet.google.com' || url.username || url.password ||
        !/^\/[a-z]{3}-[a-z]{4}-[a-z]{3}\/?$/.test(url.pathname)) {
        fail(400, 'Use the Google Meet joining link, such as https://meet.google.com/abc-defg-hij.');
    }
    return url.origin + url.pathname.replace(/\/$/, '');
}

function previewFollowUp(booking, input) {
    const message = input.message ?? '';
    if (typeof message !== 'string' || message.length > 1500) fail(400, 'Keep the client message within 1,500 characters.');
    const draft = buildFollowUp(booking, input.outcome, message.trim());
    if (!draft) fail(400, 'Choose Lead or Lost to complete the consultation.');
    return draft;
}

async function completeBooking(client, booking, input, actor) {
    if (booking.status === 'completed' && booking.outcome) {
        if (booking.outcome === input.outcome) return { booking };
        fail(409, 'An outcome has already been recorded for this consultation.');
    }
    if (!['confirmed', 'completed'].includes(booking.status)) fail(409, 'Only a confirmed or completed consultation can be closed out.');
    if (Date.parse(booking.starts_at) > Date.now()) {
        fail(409, 'The consultation has not started yet.');
    }
    if (booking.version !== input.version) fail(409, 'This consultation changed. Refresh it before recording the outcome.');

    const draft = previewFollowUp(booking, input);
    const { rows: [updated] } = await client.query(`UPDATE consultations
        SET status='completed', outcome=$2, outcome_by=$3, outcome_at=NOW(), version=version+1, updated_at=NOW()
        WHERE id=$1 RETURNING *`, [booking.id, input.outcome, actor]);
    return { booking: updated, notices: [await saveNotice(client, updated, 'complete', draft)] };
}

async function changeBooking(id, input, actor) {
    if (!UUID.test(id)) fail(404, 'Consultation not found.');
    const action = input.action;
    if (!['cancel', 'reschedule', ...(actor ? ['notes', 'confirm', 'complete', 'no_show'] : [])].includes(action)) fail(400, 'Choose a valid consultation action.');
    const result = await transaction(async client => {
        const hosts = await loadHosts(client, true);
        const { rows: [booking] } = await client.query('SELECT * FROM consultations WHERE id=$1 FOR UPDATE', [id]);
        if (!booking) fail(404, 'Consultation not found.');
        if (action === 'notes') {
            const { rows: [updated] } = await client.query(`UPDATE consultations SET staff_notes=$2, updated_at=NOW()
                WHERE id=$1 RETURNING *`, [id, clean(input.notes, 4000)]);
            return { booking: updated };
        }
        if (action === 'complete') return completeBooking(client, booking, input, actor);
        if (action === 'confirm') {
            const meetingUrl = googleMeetUrl(input.meetingUrl);
            if (booking.status === 'confirmed' && booking.meeting_url === meetingUrl) return { booking };
            if (booking.status !== 'pending') fail(409, 'Only a pending request can be confirmed.');
            if (input.version !== booking.version) fail(409, 'This request changed. Refresh it and verify the date and time before confirming.');
            if (Date.parse(booking.starts_at) <= Date.now()) fail(409, 'Reschedule this request to a future time before confirming.');
            const { rows: [updated] } = await client.query(`UPDATE consultations
                SET status='confirmed', meeting_url=$2, confirmed_by=$3, confirmed_at=NOW(), version=version+1, updated_at=NOW()
                WHERE id=$1 RETURNING *`, [id, meetingUrl, actor]);
            return { booking: updated, notices: [await saveNotice(client, updated, action)] };
        }
        if (!['pending', 'confirmed'].includes(booking.status)) fail(409, 'This consultation has already been closed.');
        if (booking.status === 'pending' && action === 'no_show') fail(409, 'Confirm the request before closing it out.');
        const hasStarted = Date.parse(booking.starts_at) <= Date.now();
        if (!actor && hasStarted) fail(409, 'This consultation has already started.');
        if (action === 'no_show' && !hasStarted) fail(409, 'You can close out the consultation after its start time.');
        let { host_id: hostId, starts_at: startsAt, meeting_url: meetingUrl, joint } = booking;
        if (action === 'reschedule') {
            const slot = await pickSlot(client, hosts, input, booking.id);
            ({ hostId, startsAt, joint } = slot);
            if (booking.status === 'confirmed' && !booking.confirmed_at) meetingUrl = slot.meetingUrl;
            const overlap = await client.query(`SELECT id FROM consultations
                WHERE id<>$1 AND email=$2 AND starts_at=$3 AND status IN ('pending','confirmed')`, [id, booking.email, startsAt]);
            if (overlap.rows.length) fail(409, 'The client already has a consultation at this time.');
            if (hostId === booking.host_id && joint === booking.joint && Date.parse(startsAt) === Date.parse(booking.starts_at)) {
                fail(400, 'Choose a different time or consultant.');
            }
        }
        const status = { cancel: 'cancelled', no_show: 'no_show', reschedule: booking.status }[action];
        const { rows: [updated] } = await client.query(`UPDATE consultations SET host_id=$2, starts_at=$3, meeting_url=$4,
            status=$5, joint=$6, version=version+1, updated_at=NOW() WHERE id=$1 RETURNING *`, [id, hostId, startsAt, meetingUrl, status, joint]);
        let notices = [];
        if (booking.status === 'confirmed' && ['cancel', 'reschedule'].includes(action)) {
            notices = [await saveNotice(client, updated, action)];
        } else if (booking.status === 'pending' && action === 'reschedule') {
            notices = await saveRequestNotices(client, updated);
        }
        return { booking: updated, notices };
    });
    await Promise.all((result.notices || []).map(dispatchNotice));
    return result.booking;
}

module.exports = { HOSTS, HOST_ROLES, consultationHostName, TOPICS, DURATION, timeWindow, checkedHost, validDate, normalizeSchedule,
    loadHosts, slotsFor, nextOpenDate, createBooking, changeBooking, publicBooking, manageToken, verifyToken, previewFollowUp, fail };
