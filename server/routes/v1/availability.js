/**
 * Availability Routes — /api/v1/availability
 * Returns available time slots for a given date, tenant, and optionally a service.
 *
 * When service_id is provided, slot availability accounts for the full
 * service duration + buffer so a 90-minute service at 5:30 PM is correctly
 * blocked (it would run past closing time / overlap other bookings).
 */

const express = require('express');
const router  = express.Router();
const { query } = require('../../db/connection');

// ─── Business Rule Constants ───────────────────────────────────────────────────
const SLOT_INTERVAL_MINS   = 30;
const DAY_START_HOUR       = 9;    // 9:00 AM
const DAY_END_HOUR         = 19;
const DAY_END_MINS         = 0;    // 7:00 PM last possible slot start
const MAX_BOOKINGS_PER_DAY = 14;
const MIN_BUFFER_MINS      = 15;   // Reject slots within 15 min of now
const MAX_DAYS_AHEAD       = 30;
const BUSINESS_CLOSE_MINS  = 20 * 60; // 8:00 PM — no service can run past this

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

function generateSlots(businessHoursStr, requestedDateStr) {
    // 1. Determine day of week
    const d = new Date(requestedDateStr + 'T12:00:00Z');
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = days[d.getUTCDay()];

    // 2. Parse business hours, fallback to defaults
    let hours;
    try {
        hours = typeof businessHoursStr === 'string' ? JSON.parse(businessHoursStr) : businessHoursStr;
    } catch(e) {}
    
    if (!hours) {
        hours = {
            monday:    { open: '09:00', close: '19:00', active: true },
            tuesday:   { open: '09:00', close: '19:00', active: true },
            wednesday: { open: '09:00', close: '19:00', active: true },
            thursday:  { open: '09:00', close: '19:00', active: true },
            friday:    { open: '09:00', close: '19:00', active: true },
            saturday:  { open: '09:00', close: '19:00', active: true },
            sunday:    { open: '10:00', close: '16:00', active: false }
        };
    }

    const todayHours = hours[dayName] || { active: false, open: '09:00', close: '17:00' };
    const slots = [];

    if (!todayHours.active) {
        return { slots: [], isClosed: true, closeMins: 0 };
    }

    const is24Hours = Boolean(todayHours.is24Hours);
    const [openH, openM] = (todayHours.open || '09:00').split(':').map(Number);
    const [closeH, closeM] = (todayHours.close || '17:00').split(':').map(Number);

    const startMin = is24Hours ? 0 : (openH * 60 + openM);
    const endMin = is24Hours ? (24 * 60) : (closeH * 60 + closeM);
    const lastSlotMin = is24Hours ? (endMin - SLOT_INTERVAL_MINS) : endMin;

    for (let m = startMin; m <= lastSlotMin; m += SLOT_INTERVAL_MINS) {
        const h = Math.floor(m / 60);
        const min = m % 60;
        const time = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
        const h12 = h > 12 ? h - 12 : (h === 0 ? 12 : h);
        const ampm = h >= 12 ? 'PM' : 'AM';
        slots.push({
            time,
            label: `${h12}:${String(min).padStart(2, '0')} ${ampm}`,
            available: true
        });
    }
    return { slots, isClosed: false, closeMins: endMin };
}

// GET /api/v1/availability?date=YYYY-MM-DD[&service_id=UUID]
router.get('/', async (req, res) => {
    const { date, service_id } = req.query;
    const tenantId = req.tenant.id;
    const timezone = req.tenant.branding?.timezone || 'America/Jamaica';

    if (!date) return res.status(400).json({ error: 'date query parameter is required (YYYY-MM-DD).' });

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });

    const todayStr   = getTzTimeStr(timezone).split('T')[0];
    const maxDateStr = getTzTimeStr(timezone, 0, MAX_DAYS_AHEAD).split('T')[0];

    if (date < todayStr || date > maxDateStr) {
        return res.json({ date, slots: [], message: 'Date is out of bookable range.' });
    }

    // ── Fetch service duration if service_id provided ──────────────────────────
    let serviceDurationMins = 30; // Default slot length
    let serviceBufferMins   = 0;

    if (service_id) {
        try {
            const svcRes = await query(
                `SELECT duration_minutes, buffer_time_minutes FROM services WHERE id = $1 AND tenant_id = $2`,
                [service_id, tenantId]
            );
            if (svcRes.rows.length > 0) {
                serviceDurationMins = svcRes.rows[0].duration_minutes || 30;
                serviceBufferMins   = svcRes.rows[0].buffer_time_minutes || 0;
            }
        } catch (e) {
            console.warn('[Availability] Could not fetch service duration:', e.message);
        }
    }

    const totalServiceMins = serviceDurationMins + serviceBufferMins;

    const { slots, isClosed, closeMins } = generateSlots(req.tenant.business_hours, date);

    if (isClosed) {
        return res.json({ date, slots: [], dayBlocked: true, message: 'Business is closed on this day.' });
    }

    // Mark past/too-close slots
    const bufferedNow = getTzTimeStr(timezone, MIN_BUFFER_MINS);
    slots.forEach(slot => {
        if (`${date}T${slot.time}` < bufferedNow) {
            slot.available = false;
            slot.reason    = 'PAST';
        }
    });

    // Block slots where service would run past closing time
    slots.forEach(slot => {
        if (!slot.available) return;
        const [h, m] = slot.time.split(':').map(Number);
        const slotStartMins = h * 60 + m;
        if (slotStartMins + totalServiceMins > closeMins) {
            slot.available = false;
            slot.reason    = 'TOO_LATE';
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

        const adminBlocks  = blocksResult.rows;
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
            if (slot.available && Object.prototype.hasOwnProperty.call(slotBlockMap, slot.time)) {
                slot.available  = false;
                slot.reason     = 'UNAVAILABLE';
                if (slotBlockMap[slot.time]) slot.adminReason = slotBlockMap[slot.time];
            }
        });

        // 2. Check overlapping bookings using precise start_time/end_time columns.
        //    A slot is blocked if ANY confirmed/pending booking overlaps the window
        //    [slot_start, slot_start + service_duration + buffer).
        const bookedResult = await query(
            `SELECT start_time, end_time FROM bookings
             WHERE tenant_id = $1
               AND booking_date = $2
               AND status IN ('confirmed', 'pending_payment', 'pending_manual_confirmation')`,
            [tenantId, date]
        );

        const dailyTotal = bookedResult.rows.length;
        if (dailyTotal >= MAX_BOOKINGS_PER_DAY) {
            slots.forEach(slot => {
                slot.available = false;
                if (!slot.reason) slot.reason = 'FULLY_BOOKED';
            });
            return res.json({ date, slots });
        }

        // For each available slot, check whether the service window overlaps any booking
        for (const slot of slots) {
            if (!slot.available) continue;

            const [h, m] = slot.time.split(':').map(Number);
            const slotStartMins = h * 60 + m;
            const slotEndMins   = slotStartMins + totalServiceMins;

            for (const booking of bookedResult.rows) {
                if (!booking.start_time || !booking.end_time) continue;

                const bStart = new Date(booking.start_time);
                const bEnd   = new Date(booking.end_time);
                const bStartMins = bStart.getHours() * 60 + bStart.getMinutes();
                const bEndMins   = bEnd.getHours()   * 60 + bEnd.getMinutes();

                // Overlap: slot window intersects booking window
                if (slotStartMins < bEndMins && slotEndMins > bStartMins) {
                    slot.available = false;
                    slot.reason    = 'BOOKED';
                    break;
                }
            }
        }

        res.json({ date, slots, serviceDurationMins, totalServiceMins });

    } catch (err) {
        console.error('[Availability]', err.message);
        res.status(500).json({ error: 'Failed to fetch availability.' });
    }
});

module.exports = router;
