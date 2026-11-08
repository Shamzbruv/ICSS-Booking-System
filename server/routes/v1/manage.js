/**
 * Customer self-service — /api/v1/manage
 * The customer's emailed "Manage my booking" link (no account needed).
 * The signed token travels in the X-Manage-Token header, never the URL.
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { query, transaction } = require('../../db/connection');
const {
    verifyManageToken, normalizePolicy, clientOptions, normalizeReason, CLIENT_REASONS
} = require('../../services/bookingReschedule');
const { sendRescheduleRequestEmails, sendClientCancellationEmails } = require('../../services/email');
const { notifyReschedule } = require('../../services/notifications');
const calendarSync = require('../../services/calendarSync');
const bookingsRouter = require('./bookings');

const { performReschedule, afterReschedule, formatDateOnlyValue } = bookingsRouter.scheduling;

const changeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many changes in a short time. Please wait a few minutes and try again.' }
});

async function loadContext(req) {
    let claims;
    try { claims = verifyManageToken(req.headers['x-manage-token']); }
    catch { const err = new Error('This link is invalid or has expired. Please contact the business.'); err.status = 401; throw err; }
    const tenantRes = await query(`SELECT * FROM tenants WHERE id = $1 AND active = true`, [claims.tenantId]);
    const tenant = tenantRes.rows[0];
    if (!tenant) { const err = new Error('This business is no longer taking bookings online.'); err.status = 404; throw err; }
    const bookingRes = await query(
        `SELECT b.*, s.name AS service_name, s.duration_minutes, s.price AS service_list_price
         FROM bookings b LEFT JOIN services s ON s.id = b.service_id
         WHERE b.id = $1 AND b.tenant_id = $2`,
        [claims.bookingId, tenant.id]
    );
    const booking = bookingRes.rows[0];
    if (!booking) { const err = new Error('We couldn’t find this booking. It may have been removed.'); err.status = 404; throw err; }
    return { tenant, booking, policy: normalizePolicy(tenant.reschedule_policy || {}) };
}

function contactFor(tenant) {
    const site = tenant.site_config || {};
    const contact = site.contact || {};
    return {
        phone: contact.phone || null,
        whatsapp: String(contact.whatsapp || '').replace(/[^0-9]/g, '') || null,
        email: contact.email || tenant.branding?.contactEmail || null,
        address: contact.address || tenant.branding?.location || null
    };
}

function present(tenant, booking, policy, pending) {
    const options = clientOptions(booking, policy);
    const timezone = tenant.branding?.timezone || 'America/Jamaica';
    return {
        tenant: {
            name: tenant.branding?.businessName || tenant.name,
            slug: tenant.slug,
            logoUrl: tenant.site_config?.brand?.logoUrl || tenant.branding?.logoUrl || null,
            primaryColor: tenant.site_config?.style?.colors?.primary || tenant.branding?.primaryColor || '#6d28d9',
            timezone,
            contact: contactFor(tenant)
        },
        booking: {
            reference: `BK-${String(booking.id).slice(0, 8).toUpperCase()}`,
            name: booking.name,
            status: booking.status,
            service_id: booking.service_id,
            service_name: booking.service_name || 'Appointment',
            duration_minutes: booking.duration_minutes || null,
            date: formatDateOnlyValue(booking.booking_date),
            time: String(booking.booking_time || '').slice(0, 5),
            start_time: booking.start_time,
            reschedule_count: Number(booking.reschedule_count || 0),
            pending_request: pending ? { date: formatDateOnlyValue(pending.new_date), time: String(pending.new_time).slice(0, 5), requested_at: pending.created_at } : null
        },
        policy: {
            cutoffHours: policy.cutoffHours,
            maxReschedules: policy.maxReschedules,
            requireApproval: policy.requireApproval,
            reasonRequired: policy.reasonRequired
        },
        options: {
            canReschedule: options.canReschedule,
            canCancel: options.canCancel,
            rescheduleBlockedReason: options.rescheduleBlockedReason,
            cancelBlockedReason: options.cancelBlockedReason,
            remainingReschedules: options.remainingReschedules
        },
        reasons: CLIENT_REASONS
    };
}

async function pendingRequest(bookingId) {
    const r = await query(`SELECT * FROM booking_reschedules WHERE booking_id = $1 AND status = 'pending' ORDER BY created_at DESC LIMIT 1`, [bookingId]);
    return r.rows[0] || null;
}

function fail(res, err, label) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error(`[Manage/${label}]`, err.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again or contact the business.' });
}

// GET /api/v1/manage — booking summary + what the customer may do
router.get('/', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
        const { tenant, booking, policy } = await loadContext(req);
        res.json(present(tenant, booking, policy, await pendingRequest(booking.id)));
    } catch (err) { fail(res, err, 'Load'); }
});

// POST /api/v1/manage/reschedule — { date, time, reason_code, reason }
router.post('/reschedule', changeLimiter, async (req, res) => {
    try {
        const { tenant, booking, policy } = await loadContext(req);
        const options = clientOptions(booking, policy);
        if (!options.canReschedule) return res.status(403).json({ error: options.rescheduleBlockedReason });
        const reason = normalizeReason({ reasonCode: req.body?.reason_code, reason: req.body?.reason }, 'client', { required: policy.reasonRequired });
        const actor = { type: 'client', userId: null };
        const mode = policy.requireApproval ? 'request' : 'apply';
        const result = await performReschedule({ tenant, bookingId: booking.id, date: req.body?.date, time: req.body?.time, reason, actor, mode });

        if (mode === 'request') {
            const enriched = { ...booking };
            sendRescheduleRequestEmails(enriched, { ...result.request, reasonDisplay: reason.display }, tenant).catch(console.error);
            notifyReschedule(tenant, enriched, booking, { reason: reason.display, actor, kind: 'requested' });
        } else {
            afterReschedule(tenant, result, reason, actor);
        }
        const fresh = await loadContext(req);
        res.json({ success: true, mode, ...present(fresh.tenant, fresh.booking, fresh.policy, await pendingRequest(booking.id)) });
    } catch (err) { fail(res, err, 'Reschedule'); }
});

// POST /api/v1/manage/cancel — { reason_code, reason }
router.post('/cancel', changeLimiter, async (req, res) => {
    try {
        const { tenant, booking, policy } = await loadContext(req);
        const options = clientOptions(booking, policy);
        if (!options.canCancel) return res.status(403).json({ error: options.cancelBlockedReason });
        const reason = normalizeReason({ reasonCode: req.body?.reason_code, reason: req.body?.reason }, 'client', { required: policy.reasonRequired });
        const cancelled = await transaction(async (client) => {
            const locked = await client.query(`SELECT * FROM bookings WHERE id = $1 AND tenant_id = $2 FOR UPDATE`, [booking.id, tenant.id]);
            const current = locked.rows[0];
            if (!clientOptions(current, policy).canCancel) { const err = new Error('This booking can no longer be cancelled online.'); err.status = 409; throw err; }
            await client.query(`UPDATE booking_payments SET status = 'failed' WHERE booking_id = $1 AND status = 'pending'`, [current.id]);
            await client.query(`UPDATE booking_reschedules SET status = 'superseded', decided_at = NOW() WHERE booking_id = $1 AND status = 'pending'`, [current.id]);
            const updated = await client.query(
                `UPDATE bookings SET status = 'cancelled', cancelled_by = 'client', cancellation_reason = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
                [current.id, reason.display || null]
            );
            await client.query(
                `INSERT INTO audit_log (tenant_id, action, entity, entity_id, old_status, new_status, note) VALUES ($1, 'cancelled_by_client', 'booking', $2, $3, 'cancelled', $4)`,
                [tenant.id, current.id, current.status, reason.display || null]
            ).catch(() => {});
            return updated.rows[0];
        });
        const enriched = { ...cancelled, service_name: booking.service_name };
        calendarSync.syncBookingWithExternal(tenant.id, enriched).catch(console.error);
        sendClientCancellationEmails(enriched, reason.display, tenant).catch(console.error);
        notifyReschedule(tenant, enriched, booking, { reason: reason.display, actor: { type: 'client' }, kind: 'client_cancelled' });
        const fresh = await loadContext(req);
        res.json({ success: true, ...present(fresh.tenant, fresh.booking, fresh.policy, null) });
    } catch (err) { fail(res, err, 'Cancel'); }
});

module.exports = router;
