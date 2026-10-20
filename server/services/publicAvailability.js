'use strict';

const REASONS = {
    PAST: 'This time has passed or is too soon to book.',
    TOO_LATE: 'This service would finish after closing time.',
    BOOKED: 'Already booked.',
    FULLY_BOOKED: 'This date is fully booked.',
    UNAVAILABLE: 'Unavailable. Please choose another time.'
};

function publicAvailability(payload) {
    return {
        ...payload,
        slots: (payload.slots || []).map(slot => ({
            ...slot,
            message: slot.available ? '' : String(slot.adminReason || REASONS[slot.reason] || 'Unavailable. Please choose another time.').slice(0, 200)
        }))
    };
}

module.exports = { publicAvailability };
