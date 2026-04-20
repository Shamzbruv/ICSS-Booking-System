/**
 * Availability Routes — /api/v1/availability
 * Returns available time slots for a given date and tenant.
 * Ported and generalized from Windross api.js.
 */

const express = require('express');
const router  = express.Router();
const { query } = require('../../db/connection');

// ─── Business Rule Constants (can be moved to tenant settings in future) ──────
const SLOT_INTERVAL_MINS  = 30;
const DAY_START_HOUR      = 12;     // 12:00 PM
const DAY_END_HOUR        = 18;     // 6:00 PM
const DAY_END_MINS        = 30;     // 6:30 PM last slot
const MAX_BOOKINGS_PER_DAY = 14;
const MIN_BUFFER_MINS     = 60;     // Reject slots within 60 min of now
const MAX_DAYS_AHEAD      = 30;

/**
 * Get current time in a specific timezone as a formatted string.
 * @param {string} tz - IANA timezone string
 * @param {number} addMinutes
 * @param {number} addDays
 */
function getTzTimeStr(tz = 'America/Jamaica', addMinutes = 0, addDays = 0) {
    const now = new Date();
    if (addMinutes) now.setMinutes(now.getMinutes() + addMinutes);
    if (addDays)    now.setDate(now.getDate() + addDays);

    const str  = now.toLocaleString('en-US', { timeZone: tz });
    const d    = new Date(str);
    const yyyy = d.getFullYear();
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const dd   = String(d.getDate()).padStart(2, '0');
    const hh   = String(d.getHours()).padStart(2, '0');
    const min  = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

function generateSlots() {
    const slots = [];
    const startMins = DAY_START_HOUR * 60;
    const endMins   = DAY_END_HOUR * 60 + DAY_END_MINS;

    for (let m = startMins; m <= endMins; m += SLOT_INTERVAL_MINS) {
        const h    = Math.floor(m / 60);
        const min  = m % 60;
        const time = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
        const h12  = h > 12 ? h - 12 : (h === 0 ? 12 : h);
        const ampm = h >= 12 ? 'PM' : 'AM';
        slots.push({
            time,
            label:     `${h12}:${String(min).padStart(2, '0')} ${ampm}`,
            available: true
        });
    }
    return slots;
}

// GET /api/v1/availability?date=YYYY-MM-DD
router.get('/', async (req, res) => {
    const { date } = req.query;
    const tenantId  = req.tenant.id;
    // Timezone from tenant branding, default to Jamaica
    const timezone = req.tenant.branding?.timezone || 'America/Jamaica';

    if (!date) return res.status(400).json({ error: 'date query parameter is required (YYYY-MM-DD).' });

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });

    const todayStr   = getTzTimeStr(timezone).split('T')[0];
    const maxDateStr = getTzTimeStr(timezone, 0, MAX_DAYS_AHEAD).split('T')[0];

    if (date < todayStr || date > maxDateStr) {
        return res.json({ date, slots: [], message: 'Date is out of bookable range.' });
    }

    const slots = generateSlots();

    // Mark past/too-close slots
    const bufferedNow = getTzTimeStr(timezone, MIN_BUFFER_MINS);
    slots.forEach(slot => {
        if (`${date}T${slot.time}` < bufferedNow) {
            slot.available = false;
            slot.reason    = 'PAST';
        }
    });

    try {
        // 1. Check admin blocks
        const blocksResult = await query(
            `SELECT block_type, block_time::TEXT AS block_time, reason
             FROM unavailable_slots
             WHERE tenant_id = $1 AND block_date = $2`,
            [tenantId, date]
        );

        const adminBlocks = blocksResult.rows;
        const isDayBlocked = adminBlocks.some(b => b.block_type === 'day');

        if (isDayBlocked) {
            const dayBlock = adminBlocks.find(b => b.block_type === 'day');
            slots.forEach(slot => {
                slot.available = false;
                if (!slot.reason) slot.reason = 'UNAVAILABLE';
                if (dayBlock?.reason) slot.adminReason = dayBlock.reason;
            });
            return res.json({ date, slots, dayBlocked: true });
        }

        const slotBlockMap = {};
        adminBlocks.filter(b => b.block_type === 'slot').forEach(b => {
            slotBlockMap[b.block_time.slice(0, 5)] = b.reason || null;
        });

        slots.forEach(slot => {
            if (slot.available && slotBlockMap.hasOwnProperty(slot.time)) {
                slot.available  = false;
                slot.reason     = 'UNAVAILABLE';
                if (slotBlockMap[slot.time]) slot.adminReason = slotBlockMap[slot.time];
            }
        });

        // 2. Check DB-confirmed bookings
        const bookedResult = await query(
            `SELECT booking_time::TEXT AS booking_time, COUNT(*) AS cnt
             FROM bookings
             WHERE tenant_id = $1 AND booking_date = $2 AND status = 'confirmed'
             GROUP BY booking_time`,
            [tenantId, date]
        );

        const dailyTotal = bookedResult.rows.reduce((sum, r) => sum + parseInt(r.cnt), 0);

        if (dailyTotal >= MAX_BOOKINGS_PER_DAY) {
            slots.forEach(slot => {
                slot.available = false;
                if (!slot.reason) slot.reason = 'FULLY_BOOKED';
            });
            return res.json({ date, slots });
        }

        const bookedTimes = bookedResult.rows.map(r => r.booking_time.slice(0, 5));
        slots.forEach(slot => {
            if (slot.available && bookedTimes.includes(slot.time)) {
                slot.available = false;
                slot.reason    = 'BOOKED';
            }
        });

        res.json({ date, slots });

    } catch (err) {
        console.error('[Availability]', err.message);
        res.status(500).json({ error: 'Failed to fetch availability.' });
    }
});

module.exports = router;
