/**
 * Bookings Routes — /api/v1/bookings
 * Create, view, cancel bookings. Multi-tenant scoped.
 */

const express = require('express');
const router  = express.Router();
const { query }                 = require('../../db/connection');
const { authenticate, requireRole } = require('../../middleware/auth');
const { enforceBookingLimit }   = require('../../services/subscription');
const { sendBookingConfirmation, sendBookingCancellationEmail } = require('../../services/email');

const MAX_BOOKINGS_PER_DAY = 14;
const MAX_DAYS_AHEAD       = 30;
const MIN_BUFFER_MINS      = 60;

function getTzTimeStr(tz = 'America/Jamaica', addMinutes = 0, addDays = 0) {
    const now = new Date();
    if (addMinutes) now.setMinutes(now.getMinutes() + addMinutes);
    if (addDays)    now.setDate(now.getDate() + addDays);
    const str = now.toLocaleString('en-US', { timeZone: tz });
    const d   = new Date(str);
    const yyyy = d.getFullYear();
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const dd   = String(d.getDate()).padStart(2, '0');
    const hh   = String(d.getHours()).padStart(2, '0');
    const min  = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

// POST /api/v1/bookings — Create a new booking
router.post('/', enforceBookingLimit, async (req, res) => {
    const { name, email, phone, date, time, notes, region } = req.body;
    const tenantId = req.tenant.id;
    const timezone = req.tenant.branding?.timezone || 'America/Jamaica';

    if (!name || !email || !phone || !date || !time) {
        return res.status(400).json({ error: 'name, email, phone, date, and time are required.' });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

    if (!dateRegex.test(date)) return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    if (!timeRegex.test(time)) return res.status(400).json({ error: 'Invalid time format. Use HH:MM (24h).' });

    // Validate time within business hours (12:00 – 18:30)
    const [h, m] = time.split(':').map(Number);
    const timeMins = h * 60 + m;
    if (timeMins < 12 * 60 || timeMins > 18 * 60 + 30) {
        return res.status(400).json({ error: 'Time must be between 12:00 and 18:30.' });
    }

    const todayStr   = getTzTimeStr(timezone).split('T')[0];
    const maxDateStr = getTzTimeStr(timezone, 0, MAX_DAYS_AHEAD).split('T')[0];
    const bufferedNow = getTzTimeStr(timezone, MIN_BUFFER_MINS);

    if (date < todayStr)    return res.status(400).json({ error: 'Booking date cannot be in the past.' });
    if (date > maxDateStr)  return res.status(400).json({ error: 'Cannot book more than 30 days in advance.' });
    if (`${date}T${time}` < bufferedNow) {
        return res.status(400).json({ error: 'This time slot has already passed or is too soon. Please choose another time.' });
    }

    const sanitizedNotes = notes
        ? notes.substring(0, 500).replace(/[<>&"']/g, '')
        : null;

    try {
        // Check daily capacity
        const capacityResult = await query(
            `SELECT COUNT(*) AS cnt FROM bookings
             WHERE tenant_id = $1 AND booking_date = $2 AND status = 'confirmed'`,
            [tenantId, date]
        );

        if (parseInt(capacityResult.rows[0].cnt) >= MAX_BOOKINGS_PER_DAY) {
            return res.status(409).json({ error: 'This day is fully booked. Please choose another day.' });
        }

        // Check admin block on this day/slot
        const blockResult = await query(
            `SELECT block_type FROM unavailable_slots
             WHERE tenant_id = $1 AND block_date = $2
               AND (block_type = 'day' OR (block_type = 'slot' AND block_time::TEXT LIKE $3))`,
            [tenantId, date, `${time}%`]
        );
        if (blockResult.rows.length > 0) {
            return res.status(409).json({ error: 'This time slot is unavailable. Please choose another.' });
        }

        // Insert booking
        const result = await query(
            `INSERT INTO bookings (tenant_id, name, email, phone, booking_date, booking_time, notes, region)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id, name, email, phone, booking_date, booking_time, status`,
            [tenantId, name, email.toLowerCase().trim(), phone, date, time, sanitizedNotes, region || 'Jamaica']
        );

        const booking = result.rows[0];

        // Fire confirmation email async
        sendBookingConfirmation(booking, req.tenant).catch(console.error);

        res.status(201).json({ success: true, booking });

    } catch (err) {
        if (err.code === '23505') { // unique_violation
            return res.status(409).json({ error: 'This time slot has just been taken. Please choose another.' });
        }
        console.error('[Bookings/Create]', err.message);
        res.status(500).json({ error: 'Failed to create booking. Please try again.' });
    }
});

// GET /api/v1/bookings — List bookings (admin)
router.get('/', authenticate, requireRole('staff', 'tenant_admin', 'super_admin'), async (req, res) => {
    const { date, status, search, page = 1, limit = 50 } = req.query;
    const tenantId = req.tenant.id;
    const offset   = (parseInt(page) - 1) * parseInt(limit);

    const conditions = ['b.tenant_id = $1'];
    const params     = [tenantId];
    let p = 2;

    if (date)   { conditions.push(`b.booking_date = $${p++}`);   params.push(date); }
    if (status) { conditions.push(`b.status = $${p++}`);          params.push(status); }
    if (search) {
        conditions.push(`(b.name ILIKE $${p} OR b.email ILIKE $${p} OR b.phone ILIKE $${p})`);
        params.push(`%${search}%`); p++;
    }

    const where = conditions.join(' AND ');

    try {
        const [rows, total] = await Promise.all([
            query(
                `SELECT b.*, s.name AS service_name
                 FROM bookings b
                 LEFT JOIN services s ON s.id = b.service_id
                 WHERE ${where}
                 ORDER BY b.booking_date DESC, b.booking_time DESC
                 LIMIT $${p} OFFSET $${p + 1}`,
                [...params, parseInt(limit), offset]
            ),
            query(`SELECT COUNT(*) AS cnt FROM bookings b WHERE ${where}`, params)
        ]);

        res.json({
            bookings: rows.rows,
            total:    parseInt(total.rows[0].cnt),
            page:     parseInt(page),
            limit:    parseInt(limit)
        });
    } catch (err) {
        console.error('[Bookings/List]', err.message);
        res.status(500).json({ error: 'Failed to fetch bookings.' });
    }
});

// GET /api/v1/bookings/:id
router.get('/:id', authenticate, requireRole('staff', 'tenant_admin'), async (req, res) => {
    try {
        const result = await query(
            `SELECT * FROM bookings WHERE id = $1 AND tenant_id = $2`,
            [req.params.id, req.tenant.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Booking not found.' });
        res.json({ booking: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch booking.' });
    }
});

// PATCH /api/v1/bookings/:id/status
router.patch('/:id/status', authenticate, requireRole('staff', 'tenant_admin'), async (req, res) => {
    const { status } = req.body;
    const validStatuses = ['confirmed', 'cancelled', 'completed', 'no_show'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}.` });
    }
    try {
        const result = await query(
            `UPDATE bookings SET status = $1 WHERE id = $2 AND tenant_id = $3 RETURNING *`,
            [status, req.params.id, req.tenant.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Booking not found.' });
        res.json({ success: true, booking: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update booking status.' });
    }
});

// POST /api/v1/bookings/:id/cancel — Admin-initiated cancellation with email
router.post('/:id/cancel', authenticate, requireRole('staff', 'tenant_admin'), async (req, res) => {
    const { reason } = req.body;

    try {
        const fetchResult = await query(
            `SELECT * FROM bookings WHERE id = $1 AND tenant_id = $2`,
            [req.params.id, req.tenant.id]
        );
        if (fetchResult.rows.length === 0) return res.status(404).json({ error: 'Booking not found.' });

        const booking = fetchResult.rows[0];
        if (booking.status === 'cancelled') {
            return res.status(400).json({ error: 'Booking is already cancelled.' });
        }

        await query(
            `UPDATE bookings SET status = 'cancelled' WHERE id = $1`,
            [booking.id]
        );

        // Send cancellation email async
        sendBookingCancellationEmail(booking, reason || null, req.tenant).catch(console.error);

        res.json({ success: true });
    } catch (err) {
        console.error('[Bookings/Cancel]', err.message);
        res.status(500).json({ error: 'Failed to cancel booking.' });
    }
});

module.exports = router;
