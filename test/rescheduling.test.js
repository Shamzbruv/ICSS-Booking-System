const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_for_reschedule';
const r = require('../server/services/bookingReschedule');

const booking = (overrides = {}) => ({
    id: '4d076a23-0ec1-46c7-96ae-7342e1ba9c7a',
    tenant_id: 'a81e2c79-9ac8-4a72-9b9d-3dad3c16a1cb',
    status: 'confirmed',
    reschedule_count: 0,
    start_time: new Date(Date.now() + 72 * 36e5).toISOString(),
    ...overrides
});

test('policy defaults are safe and inputs are clamped', () => {
    assert.deepEqual(r.normalizePolicy({}), r.DEFAULT_POLICY);
    const p = r.normalizePolicy({ cutoffHours: -5, maxReschedules: 99, requireApproval: true, allowClientCancel: 'yes' });
    assert.equal(p.cutoffHours, 0);
    assert.equal(p.maxReschedules, 10);
    assert.equal(p.requireApproval, true);
    assert.equal(p.allowClientCancel, true, 'non-boolean ignored');
});

test('clients can change upcoming bookings within the policy', () => {
    const opts = r.clientOptions(booking(), r.normalizePolicy({}));
    assert.equal(opts.canReschedule, true);
    assert.equal(opts.canCancel, true);
    assert.equal(opts.remainingReschedules, 2);
});

test('cut-off, reschedule limit, disabled options and closed bookings are enforced', () => {
    const policy = r.normalizePolicy({ cutoffHours: 24, maxReschedules: 2 });
    const soon = r.clientOptions(booking({ start_time: new Date(Date.now() + 5 * 36e5).toISOString() }), policy);
    assert.equal(soon.canReschedule, false);
    assert.equal(soon.canCancel, false);
    assert.match(soon.rescheduleBlockedReason, /24 hours/);

    const maxed = r.clientOptions(booking({ reschedule_count: 2 }), policy);
    assert.equal(maxed.canReschedule, false);
    assert.equal(maxed.canCancel, true);

    const off = r.clientOptions(booking(), r.normalizePolicy({ allowClientReschedule: false, allowClientCancel: false }));
    assert.equal(off.canReschedule, false);
    assert.equal(off.canCancel, false);

    const cancelled = r.clientOptions(booking({ status: 'cancelled' }), policy);
    assert.equal(cancelled.canReschedule, false);
    assert.match(cancelled.cancelBlockedReason, /cancelled/);

    const started = r.clientOptions(booking({ start_time: new Date(Date.now() - 60000).toISOString() }), r.normalizePolicy({ cutoffHours: 0 }));
    assert.equal(started.canReschedule, false);
});

test('manage links are signed, scoped and cannot be forged or reused as logins', () => {
    const b = booking();
    const token = r.manageToken(b);
    assert.deepEqual(r.verifyManageToken(token), { bookingId: b.id, tenantId: b.tenant_id });
    assert.throws(() => r.verifyManageToken(token.slice(0, -2) + 'xx'));
    // An account JWT signed with the main secret is rejected (different key + audience).
    const loginToken = jwt.sign({ id: 'u', tenant_id: b.tenant_id, role: 'tenant_admin' }, process.env.JWT_SECRET, { subject: b.id });
    assert.throws(() => r.verifyManageToken(loginToken));
    const reviewLike = jwt.sign({ tenantId: b.tenant_id }, 'other', { audience: 'booking-manage', subject: b.id });
    assert.throws(() => r.verifyManageToken(reviewLike));
    assert.throws(() => r.verifyManageToken(undefined));
    const url = r.manageUrl(b);
    assert.match(url, /\/manage#t=/, 'token travels in the URL fragment, not the query string');
});

test('reasons are required when asked, sanitised and labelled for each side', () => {
    assert.throws(() => r.normalizeReason({}, 'client', { required: true }), /choose a reason/i);
    assert.throws(() => r.normalizeReason({ reasonCode: 'other' }, 'client', { required: true }), /tell us/i);
    const reason = r.normalizeReason({ reasonCode: 'transport', reason: 'Bus <b>late</b>' }, 'client', { required: true });
    assert.equal(reason.label, 'Transport issue');
    assert.doesNotMatch(reason.text, /[<>]/);
    assert.equal(r.normalizeReason({ reasonCode: 'staff_unavailable' }, 'staff').label, 'Staff member unavailable');
    assert.equal(r.normalizeReason({ reasonCode: 'staff_unavailable' }, 'client').code, null, 'staff codes are not valid for clients');
});

test('rescheduling is wired end to end', () => {
    const bookings = read('server/routes/v1/bookings.js');
    assert.match(bookings, /async function performReschedule\(/);
    assert.match(bookings, /AND id <> \$4 AND status IN/, 'overlap check ignores the booking being moved');
    assert.match(bookings, /validateTenantAvailability\(client, tenant, date, time, duration, allowOutsideHours\)/);
    assert.match(bookings, /router\.post\('\/:id\/reschedule'/);
    assert.match(bookings, /reschedule-requests\/:requestId\/:decision/);
    assert.ok(bookings.indexOf("router.get('/reschedule-options'") < bookings.indexOf("router.get('/:id'"), 'options route registered before /:id');
    const manage = read('server/routes/v1/manage.js');
    assert.match(manage, /x-manage-token/);
    assert.match(manage, /changeLimiter/);
    assert.match(read('server/app.js'), /app\.use\('\/api\/v1\/manage',\s+manageRoutes\)/);
    assert.match(read('server/services/email.js'), /Manage my booking/);
    assert.match(read('frontend/src/App.jsx'), /path="\/manage"/);
    assert.match(read('frontend/src/pages/ManageBooking/ManageBooking.jsx'), /history\.replaceState/);
    assert.match(read('admin/bookings.html'), /data-booking-action="reschedule"/);
    assert.match(read('admin/settings.html'), /id="reschedulePolicyForm"/);
    assert.match(read('server/services/notifications.js'), /booking_rescheduled/);
});
