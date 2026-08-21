const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
    ACTIVE_BOOKING_STATUSES,
    intervalsOverlap,
    serviceOverlapsBlockedSlot
} = require('../server/services/bookingAvailabilityRules');

const root = path.resolve(__dirname, '..');

test('pending after-hours requests reserve their full appointment window', () => {
    assert.ok(ACTIVE_BOOKING_STATUSES.includes('pending_after_hours_confirmation'));
    assert.equal(intervalsOverlap(9 * 60, 10 * 60 + 30, 10 * 60, 11 * 60), true);
    assert.equal(intervalsOverlap(9 * 60, 10 * 60, 10 * 60, 11 * 60), false);
});

test('service duration is checked against admin-blocked slots', () => {
    assert.equal(serviceOverlapsBlockedSlot(13 * 60 + 30, 90, 14 * 60 + 30), true);
    assert.equal(serviceOverlapsBlockedSlot(13 * 60, 60, 14 * 60), false);
});

test('after-hours bookings retain mandatory receipt enforcement in UI and API', () => {
    const ui = fs.readFileSync(path.join(root, 'frontend/src/themes/SharedBookingTheme.jsx'), 'utf8');
    const route = fs.readFileSync(path.join(root, 'server/routes/v1/bookings.js'), 'utf8');
    assert.match(ui, /const needsReceipt = paymentDetails\.collectNow/);
    assert.doesNotMatch(ui, /const needsReceipt = !isAfterHoursRequest/);
    assert.match(route, /A payment receipt screenshot is required for bank transfers/);
    assert.match(route, /if \(afterHoursRequested\) \{\s*status = 'pending_after_hours_confirmation'/);
    assert.doesNotMatch(route, /if \(afterHoursRequested\) \{\s*status = 'pending_after_hours_confirmation';\s*paymentMode = 'none'/);
});

test('customizer exposes visible control-to-preview highlighting', () => {
    const customizer = fs.readFileSync(path.join(root, 'admin/customize.html'), 'utf8');
    assert.match(customizer, /function highlightPreview\(key\)/);
    assert.match(customizer, /data-icss-color-highlight/);
    assert.match(customizer, /Select a color to highlight every area it controls/);
});
