const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const db = require('../server/db/connection');
const { publicAvailability } = require('../server/services/publicAvailability');

const tenantId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const serviceId = '33333333-3333-4333-8333-333333333333';
const bookingId = '44444444-4444-4444-8444-444444444444';
const future = new Date(); future.setUTCDate(future.getUTCDate() + 2);
while (future.getUTCDay() === 0) future.setUTCDate(future.getUTCDate() + 1);
const date = future.toISOString().slice(0, 10);
let state;
function reset() {
    state = { blocks: [], conflicts: [], dailyCount: 0, records: [], payments: [], audits: [],
        service: { id: serviceId, name: 'Service', active: true, duration_minutes: 60, buffer_time_minutes: 0, price: 5000, currency: 'JMD', payment_mode: 'tenant_default', payment_requirement_type: 'none' } };
}
async function fakeQuery(sql, values = []) {
    if (sql.includes('FROM impersonation_sessions')) return { rows: [{ id: 'session', mode: 'read_only' }] };
    if (sql.includes('FROM services')) return { rows: values[0] === serviceId ? [state.service] : [] };
    if (sql.includes('FROM unavailable_slots')) return { rows: state.blocks };
    if (sql.includes('FROM tenants')) return { rows: [{ id: tenantId }] };
    if (sql.includes('make_timestamptz')) return { rows: [{ st: `${date}T14:00:00Z`, et: `${date}T15:00:00Z` }] };
    if (sql.includes('COUNT(*)')) return { rows: [{ count: state.dailyCount }] };
    if (sql.includes('FROM bookings')) return { rows: state.conflicts };
    if (sql.includes('INSERT INTO bookings')) {
        const booking = { id: bookingId, tenant_id: values[0], name: values[2], email: values[3], phone: values[4], booking_date: values[5], booking_time: values[6], status: values[11], payment_mode: values[12], booking_source: values[21], created_by_user_id: values[22], terms_acceptance_method: values[23] };
        state.records.push(booking); return { rows: [booking] };
    }
    if (sql.includes('INSERT INTO booking_payments')) { state.payments.push({ provider: values[2], amount: values[4], status: 'pending' }); return { rows: [{ id: 'payment' }] }; }
    if (sql.includes('INSERT INTO audit_log')) { state.audits.push(values); return { rows: [] }; }
    throw new Error(`Unexpected query: ${sql}`);
}
db.query = fakeQuery;
db.transaction = async callback => callback({ query: fakeQuery });
function stub(modulePath, exports) { const id = require.resolve(modulePath); require.cache[id] = { id, filename: id, loaded: true, exports }; }
stub('../server/services/email', { sendBookingCancellationEmail: async () => {}, sendBookingPendingReviewEmail: async () => {}, sendBookingCompletedEmail: async () => {} });
stub('../server/services/bookingNotifications', { sendBookingConfirmationNotifications: async () => {} });
stub('../server/services/calendarSync', { syncBookingWithExternal: async () => {} });
const { signToken } = require('../server/middleware/auth');
const app = express(); app.use(express.json());
app.use((req, res, next) => { req.tenant = { id: tenantId, slug: 'mine', branding: { timezone: 'America/Jamaica' }, default_payment_mode: 'none', manual_payment_enabled: true, business_hours: state.hours }; next(); });
app.use('/bookings', require('../server/routes/v1/bookings'));
app.use('/availability', require('../server/routes/v1/availability'));
let server, base;
test.before(async () => { server = http.createServer(app); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${server.address().port}`; });
test.after(() => new Promise(resolve => server.close(resolve)));
test.beforeEach(reset);
const payload = () => ({ name: 'Phone customer', phone: '+18765550123', service_id: serviceId, date, time: '10:00', verbal_consent: true, terms_accepted: true, payment_handling: 'normal' });
const token = (claims = {}) => signToken({ id: userId, tenant_id: tenantId, role: 'staff', ...claims });
async function post(body, auth = token(), url = '/bookings/assisted') {
    const response = await fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) }, body: JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
}

test('staff can record a phone booking without inventing a customer email, with attribution and verbal consent', async () => {
    const result = await post(payload());
    assert.equal(result.status, 201);
    assert.equal(result.data.booking.status, 'confirmed');
    assert.equal(result.data.booking.email, '');
    assert.equal(result.data.booking.booking_source, 'phone');
    assert.equal(result.data.booking.created_by_user_id, userId);
    assert.equal(result.data.booking.terms_acceptance_method, 'verbal');
    assert.equal(state.audits.length, 1);
});

test('assisted booking rejects anonymous, customer, foreign-tenant and read-only callers', async () => {
    assert.equal((await post(payload(), null)).status, 401);
    assert.equal((await post(payload(), token({ role: 'customer' }))).status, 403);
    assert.equal((await post(payload(), token({ tenant_id: serviceId }))).status, 403);
    assert.equal((await post(payload(), token({ impersonation_session_id: 'session' }))).status, 403);
    assert.equal(state.records.length, 0);
});

test('caller consent is required and public callers cannot activate staff-only behavior', async () => {
    assert.equal((await post({ ...payload(), verbal_consent: false })).status, 400);
    const result = await post({ ...payload(), email: 'client@example.com', assistedBooking: true, terms_accepted: false }, null, '/bookings');
    assert.equal(result.status, 400);
    assert.match(result.data.error, /accept the ICSS Bookings Terms/);
    assert.equal(state.records.length, 0);
});

test('public and assisted bookings reject missing or non-boolean platform terms acceptance', async () => {
    for (const assisted of [false, true]) {
        for (const consent of [undefined, false, null, 'true', 1]) {
            const result = await post({ ...payload(), email: 'client@example.com', terms_accepted: consent },
                assisted ? token() : null, assisted ? '/bookings/assisted' : '/bookings');
            assert.equal(result.status, 400);
            assert.match(result.data.error, /ICSS Bookings Terms/);
        }
    }
    assert.equal(state.records.length, 0);
    const accepted = await post({ ...payload(), email: 'client@example.com' }, null, '/bookings');
    assert.equal(accepted.status, 201);
    assert.equal(accepted.data.booking.terms_acceptance_method, 'online');
});

test('offline required payment remains pending, and normal transfers still require a receipt', async () => {
    state.service.payment_requirement_type = 'full';
    const result = await post({ ...payload(), payment_handling: 'in_person' });
    assert.equal(result.status, 201);
    assert.equal(result.data.booking.status, 'pending_payment');
    assert.equal(result.data.booking.payment_mode, 'in_person');
    assert.deepEqual(state.payments, [{ provider: 'in_person', amount: 5000, status: 'pending' }]);
    assert.equal(result.data.amountDue, 5000);
    state.service.payment_mode = 'manual';
    const normal = await post(payload());
    assert.equal(normal.status, 400);
    assert.match(normal.data.error, /receipt/);
    assert.equal(state.payments.length, 1);
});

test('day blocks, overlapping slot blocks, booking conflicts and daily capacity cannot be bypassed', async () => {
    state.blocks = [{ block_type: 'day', reason: 'Closed for maintenance' }];
    let result = await post(payload()); assert.equal(result.status, 400); assert.match(result.data.error, /maintenance/);
    state.blocks = [{ block_type: 'slot', block_time: '10:30', reason: 'Team meeting' }];
    result = await post(payload()); assert.equal(result.status, 400); assert.match(result.data.error, /Team meeting/);
    state.blocks = []; state.conflicts = [{ id: bookingId }];
    assert.equal((await post(payload())).status, 409);
    state.conflicts = []; state.dailyCount = 14;
    assert.equal((await post(payload())).status, 409);
    assert.equal(state.records.length, 0);
});

test('availability returns customer-facing day and overlapping slot reasons without booking identities', async () => {
    state.blocks = [{ block_type: 'day', reason: 'Public holiday closure' }];
    let response = await fetch(`${base}/availability?date=${date}&service_id=${serviceId}`);
    let data = await response.json();
    assert.equal(data.message, 'Public holiday closure');
    assert.ok(data.slots.every(slot => !slot.available && slot.message === 'Public holiday closure'));
    state.hours = Object.fromEntries(['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(day => [day, { active: false }]));
    response = await fetch(`${base}/availability?date=${date}&service_id=${serviceId}`); data = await response.json();
    assert.equal(data.message, 'Public holiday closure', 'explicit block reasons must take precedence over weekly closed days');
    state.hours = null;
    state.blocks = [{ block_type: 'slot', block_time: '10:30', reason: 'Staff training' }];
    response = await fetch(`${base}/availability?date=${date}&service_id=${serviceId}`); data = await response.json();
    assert.equal(data.slots.find(slot => slot.time === '10:00').message, 'Staff training');
    assert.equal(data.slots.find(slot => slot.time === '11:00').available, true);
    assert.equal(JSON.stringify(data).includes('Phone customer'), false);
    assert.equal(publicAvailability({ slots: [{ time: '09:00', available: false, reason: 'BOOKED' }] }).slots[0].message, 'Already booked.');
});
