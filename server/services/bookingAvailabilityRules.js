'use strict';

const SLOT_INTERVAL_MINS = 30;
const ACTIVE_BOOKING_STATUSES = Object.freeze([
    'confirmed',
    'pending_payment',
    'pending_manual_confirmation',
    'pending_after_hours_confirmation'
]);
const ACTIVE_BOOKING_STATUSES_SQL = ACTIVE_BOOKING_STATUSES.map((status) => `'${status}'`).join(', ');

function timeTextToMinutes(value) {
    if (!value) return null;
    const [hours, minutes] = String(value).slice(0, 5).split(':').map(Number);
    if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return null;
    }
    return (hours * 60) + minutes;
}

function intervalsOverlap(firstStart, firstEnd, secondStart, secondEnd) {
    return firstStart < secondEnd && firstEnd > secondStart;
}

function serviceOverlapsBlockedSlot(serviceStartMins, serviceDurationMins, blockedStartMins) {
    return intervalsOverlap(
        serviceStartMins,
        serviceStartMins + serviceDurationMins,
        blockedStartMins,
        blockedStartMins + SLOT_INTERVAL_MINS
    );
}

module.exports = {
    ACTIVE_BOOKING_STATUSES,
    ACTIVE_BOOKING_STATUSES_SQL,
    SLOT_INTERVAL_MINS,
    intervalsOverlap,
    serviceOverlapsBlockedSlot,
    timeTextToMinutes
};
