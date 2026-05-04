/**
 * Bookings Routes — /api/v1/bookings
 * Create, view, cancel bookings. Multi-tenant scoped.
 */

const express = require('express');
const router  = express.Router();
const { query, transaction }    = require('../../db/connection');
const { authenticate, requireRole } = require('../../middleware/auth');
const { enforceBookingLimit }   = require('../../services/subscription');
const { sendBookingConfirmation, sendBookingCancellationEmail, sendBookingPendingReviewEmail } = require('../../services/email');
const calendarSync              = require('../../services/calendarSync');
const wipay                     = require('../../services/wipay');
const { normalizeDepositConfig, calculateAmountDue } = require('../../services/paymentRules');

const MAX_BOOKINGS_PER_DAY = 14;
const MAX_DAYS_AHEAD       = 30;
const MIN_BUFFER_MINS      = 15;

function formatDateOnlyValue(value) {
    if (!value) return value;

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const year = value.getUTCFullYear();
        const month = String(value.getUTCMonth() + 1).padStart(2, '0');
        const day = String(value.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    const match = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[1]}-${match[2]}-${match[3]}` : String(value);
}

function formatTimeOnlyValue(value) {
    if (!value) return value;
    return String(value).trim().slice(0, 8);
}

function serializeBooking(booking) {
    if (!booking) return booking;
    return {
        ...booking,
        booking_date: formatDateOnlyValue(booking.booking_date),
        booking_time: formatTimeOnlyValue(booking.booking_time)
    };
}

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

function getDefaultBusinessHours() {
    return {
        monday:    { open: '09:00', close: '19:00', active: true },
        tuesday:   { open: '09:00', close: '19:00', active: true },
        wednesday: { open: '09:00', close: '19:00', active: true },
        thursday:  { open: '09:00', close: '19:00', active: true },
        friday:    { open: '09:00', close: '19:00', active: true },
        saturday:  { open: '09:00', close: '19:00', active: true },
        sunday:    { open: '10:00', close: '16:00', active: false }
    };
}

function getDaySchedule(businessHours, requestedDateStr) {
    const d = new Date(`${requestedDateStr}T12:00:00Z`);
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = days[d.getUTCDay()];

    let hours = businessHours;
    try {
        hours = typeof businessHours === 'string' ? JSON.parse(businessHours) : businessHours;
    } catch (e) {
        hours = null;
    }

    const resolvedHours = hours || getDefaultBusinessHours();
    const dayHours = resolvedHours[dayName] || { active: false, open: '09:00', close: '17:00' };
    const is24Hours = Boolean(dayHours.is24Hours);
    const [openHour, openMinute] = (dayHours.open || '09:00').split(':').map(Number);
    const [closeHour, closeMinute] = (dayHours.close || '17:00').split(':').map(Number);

    return {
        dayName,
        active: Boolean(dayHours.active),
        startMins: is24Hours ? 0 : ((openHour * 60) + openMinute),
        endMins: is24Hours ? (24 * 60) : ((closeHour * 60) + closeMinute)
    };
}

async function validateTenantAvailability(client, tenant, date, time, totalServiceMins) {
    const schedule = getDaySchedule(tenant.business_hours, date);

    if (!schedule.active) {
        const err = new Error('This date is unavailable because the business is closed.');
        err.status = 400;
        throw err;
    }

    const [hour, minute] = time.split(':').map(Number);
    const slotStartMins = (hour * 60) + minute;
    const slotEndMins = slotStartMins + totalServiceMins;

    if (slotStartMins < schedule.startMins || slotEndMins > schedule.endMins) {
        const err = new Error('This time falls outside the business schedule for the selected date.');
        err.status = 400;
        throw err;
    }

    const blocksResult = await client.query(
        `SELECT block_type, block_time::TEXT AS block_time, reason
         FROM unavailable_slots
         WHERE tenant_id = $1 AND block_date = $2`,
        [tenant.id, date]
    );

    const dayBlock = blocksResult.rows.find((block) => block.block_type === 'day');
    if (dayBlock) {
        const err = new Error(dayBlock.reason || 'This date is unavailable.');
        err.status = 400;
        throw err;
    }

    const slotBlock = blocksResult.rows.find((block) =>
        block.block_type === 'slot' && String(block.block_time || '').slice(0, 5) === time
    );
    if (slotBlock) {
        const err = new Error(slotBlock.reason || 'This time slot is unavailable.');
        err.status = 400;
        throw err;
    }
}

// POST /api/v1/bookings — Create a new booking
router.post('/', enforceBookingLimit, async (req, res) => {
    const { name, email, phone, date, time, notes, region, service_id, receipt_image } = req.body;
    const tenant = req.tenant;
    const tenantId = tenant.id;
    const timezone = tenant.branding?.timezone || 'America/Jamaica';

    if (!name || !email || !phone || !date || !time || !service_id) {
        return res.status(400).json({ error: 'name, email, phone, date, time, and service_id are required.' });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

    if (!dateRegex.test(date)) return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    if (!timeRegex.test(time)) return res.status(400).json({ error: 'Invalid time format. Use HH:MM (24h).' });

    const todayStr   = getTzTimeStr(timezone).split('T')[0];
    const maxDateStr = getTzTimeStr(timezone, 0, MAX_DAYS_AHEAD).split('T')[0];
    const bufferedNow = getTzTimeStr(timezone, MIN_BUFFER_MINS);

    if (date < todayStr)    return res.status(400).json({ error: 'Booking date cannot be in the past.' });
    if (date > maxDateStr)  return res.status(400).json({ error: 'Cannot book more than 30 days in advance.' });
    if (`${date}T${time}` < bufferedNow) {
        return res.status(400).json({ error: 'This time slot has already passed or is too soon. Please choose another time.' });
    }

    const sanitizedNotes = notes ? notes.substring(0, 500).replace(/[<>&"']/g, '') : null;

    try {
        const result = await transaction(async (client) => {
            // Pessimistic Locking: Lock the tenant row to serialize concurrent booking attempts
            // This prevents race conditions on capacity checks and slot availability.
            await client.query(`SELECT id FROM tenants WHERE id = $1 FOR UPDATE`, [tenantId]);

            // 1. Fetch Service Details
            const svcRes = await client.query(`SELECT * FROM services WHERE id = $1 AND tenant_id = $2`, [service_id, tenantId]);
            if (svcRes.rows.length === 0) {
                const err = new Error('Service not found.'); err.status = 404; throw err;
            }
            const service = normalizeDepositConfig(svcRes.rows[0]);

            // 2. Determine Payment Mode & Timeouts
            const paymentRequirement = service.payment_requirement_type || 'none';
            let paymentMode = service.payment_mode;
            if (!paymentMode || paymentMode === 'tenant_default') {
                paymentMode = tenant.default_payment_mode || 'none';
            }
            
            let status = 'confirmed';
            let expiresAt = null;
            const holdTimeout = tenant.hold_timeout_minutes || 15;

            const amountDue = calculateAmountDue(service);
            const paymentRequested = amountDue > 0;

            if (paymentRequested && paymentMode === 'wipay' && tenant.wipay_enabled) {
                status = 'pending_payment';
                expiresAt = new Date(Date.now() + holdTimeout * 60000);
            } else if (paymentRequested && paymentMode === 'manual' && tenant.manual_payment_enabled) {
                if (!receipt_image) {
                    const err = new Error('A payment receipt screenshot is required for bank transfers.'); err.status = 400; throw err;
                }
                status = 'pending_manual_confirmation';
                expiresAt = null;
            } else if (paymentRequested) {
                const err = new Error('This service requires payment before booking, but the configured payment method is unavailable.'); err.status = 400; throw err;
            } else {
                paymentMode = 'none';
            }

            // 3. Validate selected date and time against the tenant's published schedule
            const startTimeStr = `${date}T${time}:00`;
            const duration = (service.duration_minutes || 30) + (service.buffer_time_minutes || 0);
            await validateTenantAvailability(client, tenant, date, time, duration);

            // PostgreSQL parses this assuming the DB timezone, but we enforce overlap relatively.
            // Using precise timestamps:
            const startTimeQuery = await client.query(`SELECT $1::timestamptz AS st, $1::timestamptz + interval '${duration} minutes' AS et`, [startTimeStr]);
            const startTime = startTimeQuery.rows[0].st;
            const endTime = startTimeQuery.rows[0].et;

            // 4. Check for overlapping bookings at the DB level
            const overlapCheck = await client.query(
                `SELECT id FROM bookings 
                 WHERE tenant_id = $1 
                 AND status IN ('confirmed', 'pending_payment', 'pending_manual_confirmation')
                 AND start_time < $3 AND end_time > $2`,
                [tenantId, startTime, endTime]
            );

            if (overlapCheck.rows.length > 0) {
                const err = new Error('This time slot is no longer available. Please choose another.'); err.status = 409; throw err;
            }

            // 5. Insert Booking
            const bookingRes = await client.query(
                `INSERT INTO bookings (tenant_id, service_id, name, email, phone, booking_date, booking_time, start_time, end_time, notes, region, status, payment_mode, expires_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                 RETURNING *`,
                [tenantId, service_id, name, email.toLowerCase().trim(), phone, date, time, startTime, endTime, sanitizedNotes, region || 'Jamaica', status, paymentMode, expiresAt]
            );
            const booking = bookingRes.rows[0];

            let checkoutUrl = null;
            let bankInstructions = null;

            // 6. Handle Payment Records
            if (paymentMode !== 'none' && amountDue > 0) {
                const paymentRes = await client.query(
                    `INSERT INTO booking_payments (booking_id, tenant_id, provider, payment_type, amount_due, status, gateway_response)
                     VALUES ($1, $2, $3, $4, $5, 'pending', $6) RETURNING *`,
                    [booking.id, tenantId, paymentMode, paymentRequirement, amountDue, paymentMode === 'manual' ? JSON.stringify({ receipt_image }) : null]
                );
                const payment = paymentRes.rows[0];

                if (paymentMode === 'wipay') {
                    const baseUrl = process.env.PUBLIC_APP_URL || process.env.BASE_URL || `${req.headers['x-forwarded-proto'] || req.protocol}://${req.get('host')}`;
                    const returnUrl = `${baseUrl}/payment-processing?booking=${booking.id}`;
                    checkoutUrl = wipay.generateCheckoutUrl(tenant, booking, payment, returnUrl);
                } else if (paymentMode === 'manual') {
                    bankInstructions = tenant.bank_transfer_instructions;
                }
            }

            return { booking, checkoutUrl, bankInstructions, service_name: service.name };
        });

        // 7. Enqueue Expiration Job if there is a hold
        if (result.booking.status === 'pending_payment' && result.booking.expires_at) {
            const { enqueue } = require('../../services/queue');
            await enqueue('expire-booking-hold', { bookingId: result.booking.id }, {
                startAfter: result.booking.expires_at
            });
        }

        // 8. If confirmed immediately, send emails
        if (result.booking.status === 'confirmed') {
            // Attach service_name so the email template can display it
            const enrichedBooking = { ...result.booking, service_name: result.service_name };
            calendarSync.syncBookingWithExternal(req.tenant.id, enrichedBooking).catch(console.error);
            sendBookingConfirmation(enrichedBooking, req.tenant).catch(console.error);
        } else if (result.booking.status === 'pending_manual_confirmation') {
            const enrichedBooking = { ...result.booking, service_name: result.service_name };
            sendBookingPendingReviewEmail(enrichedBooking, req.tenant).catch(console.error);
        }

        res.status(201).json({ success: true, ...result, booking: serializeBooking(result.booking) });

    } catch (err) {
        if (err.status) return res.status(err.status).json({ error: err.message });
        console.error('[Bookings/Create]', err.message);
        res.status(500).json({ error: 'Failed to create booking. Please try again.' });
    }
});

// POST /api/v1/bookings/:id/verify-payment — WiPay Callback / Polling
router.post('/:id/verify-payment', async (req, res) => {
    const bookingId = req.params.id;
    const { transaction_id } = req.body; // Provided by frontend from WiPay URL params

    try {
        const result = await transaction(async (client) => {
            // Lock the booking
            const bRes = await client.query(`SELECT * FROM bookings WHERE id = $1 FOR UPDATE`, [bookingId]);
            if (bRes.rows.length === 0) {
                const err = new Error('Booking not found.'); err.status = 404; throw err;
            }
            const booking = bRes.rows[0];

            if (booking.status === 'confirmed') return booking; // Already processed
            if (booking.status !== 'pending_payment') {
                const err = new Error('Booking is not awaiting payment.'); err.status = 400; throw err;
            }

            // Get tenant
            const tRes = await client.query(`SELECT * FROM tenants WHERE id = $1`, [booking.tenant_id]);
            const tenant = tRes.rows[0];

            // Get payment record
            const pRes = await client.query(`SELECT * FROM booking_payments WHERE booking_id = $1 AND status = 'pending'`, [booking.id]);
            if (pRes.rows.length === 0) {
                const err = new Error('Payment record not found.'); err.status = 404; throw err;
            }
            const payment = pRes.rows[0];

            // Verify with WiPay
            const verification = await wipay.verifyTransaction(transaction_id, payment.id, tenant);
            
            // Normalize WiPay status — accept the same approved states as the webhook route
            const isPaid = ['success', 'approved'].includes((verification.status || '').toLowerCase());
            
            if (isPaid) {
                await client.query(
                    `UPDATE booking_payments SET status = 'paid', external_reference = $1, gateway_response = $2 WHERE id = $3`,
                    [transaction_id, JSON.stringify(verification), payment.id]
                );
                const updatedBookingRes = await client.query(
                    `UPDATE bookings SET status = 'confirmed', updated_at = NOW() WHERE id = $1 RETURNING *`,
                    [booking.id]
                );
                return updatedBookingRes.rows[0];
            } else {
                const err = new Error('Payment verification failed.'); err.status = 400; throw err;
            }
        });

        // Async follow-up
        if (result.status === 'confirmed') {
            const tRes = await query(`SELECT * FROM tenants WHERE id = $1`, [result.tenant_id]);
            calendarSync.syncBookingWithExternal(result.tenant_id, result).catch(console.error);
            sendBookingConfirmation(result, tRes.rows[0]).catch(console.error);
        }

        res.json({ success: true, booking: serializeBooking(result) });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ error: err.message });
        console.error('[Bookings/Verify]', err.message);
        res.status(500).json({ error: 'Payment verification failed.' });
    }
});

// GET /api/v1/bookings — List bookings (admin)
router.get('/', authenticate, requireRole('staff', 'tenant_admin', 'super_admin'), async (req, res) => {
    // ... [Admin listing logic retained but omitted for brevity in this replace block, 
    // Wait, since this is a full replacement, I must include it!]
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
            bookings: rows.rows.map(serializeBooking),
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
        res.json({ booking: serializeBooking(result.rows[0]) });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch booking.' });
    }
});

// PATCH /api/v1/bookings/:id/status (Admin approval logic)
router.patch('/:id/status', authenticate, requireRole('staff', 'tenant_admin'), async (req, res) => {
    const { status, note } = req.body;
    const validStatuses = ['confirmed', 'cancelled', 'completed', 'no_show', 'rejected'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}.` });
    }
    
    try {
        const result = await transaction(async (client) => {
            const bRes = await client.query(`SELECT * FROM bookings WHERE id = $1 AND tenant_id = $2 FOR UPDATE`, [req.params.id, req.tenant.id]);
            if (bRes.rows.length === 0) {
                const err = new Error('Booking not found.'); err.status = 404; throw err;
            }
            const booking = bRes.rows[0];

            // Audit Logging for manual bank transfer approvals/rejections
            if (booking.payment_mode === 'manual' && booking.status === 'pending_manual_confirmation') {
                if (status === 'confirmed' || status === 'rejected') {
                    await client.query(
                        `INSERT INTO audit_log (tenant_id, user_id, actor_user_id, action, entity, entity_id, old_status, new_status, note)
                         VALUES ($1, $2, $3, $4, 'booking', $5, $6, $7, $8)`,
                        [req.tenant.id, req.user.id, req.user.id, `manual_transfer_${status}`, booking.id, booking.status, status, note]
                    );

                    if (status === 'confirmed') {
                        await client.query(`UPDATE booking_payments SET status = 'paid' WHERE booking_id = $1`, [booking.id]);
                    }
                }
            }

            const updRes = await client.query(
                `UPDATE bookings SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
                [status, booking.id]
            );
            return updRes.rows[0];
        });

        // Async tasks
        if (status === 'confirmed') {
            calendarSync.syncBookingWithExternal(req.tenant.id, result).catch(console.error);
            sendBookingConfirmation(result, req.tenant).catch(console.error);
        } else if (status === 'cancelled' || status === 'rejected') {
            sendBookingCancellationEmail(result, note, req.tenant).catch(console.error);
        }

        res.json({ success: true, booking: serializeBooking(result) });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ error: err.message });
        console.error('[Bookings/StatusUpdate]', err.message);
        res.status(500).json({ error: 'Failed to update booking status.' });
    }
});

// POST /api/v1/bookings/:id/cancel — Admin-initiated cancellation with email
router.post('/:id/cancel', authenticate, requireRole('staff', 'tenant_admin'), async (req, res) => {
    const { reason } = req.body;
    try {
        const fetchResult = await query(`SELECT * FROM bookings WHERE id = $1 AND tenant_id = $2`, [req.params.id, req.tenant.id]);
        if (fetchResult.rows.length === 0) return res.status(404).json({ error: 'Booking not found.' });

        const booking = fetchResult.rows[0];
        if (booking.status === 'cancelled') return res.status(400).json({ error: 'Booking is already cancelled.' });

        await query(`UPDATE bookings SET status = 'cancelled', updated_at = NOW() WHERE id = $1`, [booking.id]);
        booking.status = 'cancelled';

        sendBookingCancellationEmail(booking, reason || null, req.tenant).catch(console.error);
        calendarSync.syncBookingWithExternal(req.tenant.id, booking).catch(console.error);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to cancel booking.' });
    }
});

module.exports = router;
