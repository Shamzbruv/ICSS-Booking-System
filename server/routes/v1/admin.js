/**
 * Admin Routes — /api/v1/admin
 * Availability management, dashboard summary, design inquiries.
 * All routes require staff or tenant_admin role.
 */

const express = require('express');
const router  = express.Router();
const { query }  = require('../../db/connection');
const { authenticate, requireRole } = require('../../middleware/auth');

// All admin routes require authentication
router.use(authenticate);
router.use(requireRole('staff', 'tenant_admin', 'super_admin'));

// ── Dashboard Summary ──────────────────────────────────────────────────────────
// GET /api/v1/admin/summary
router.get('/summary', async (req, res) => {
    const tenantId = req.tenant.id;
    try {
        const [confirmed, cancelled, newDesigns, totalDesigns, activeBlocks, monthlyBookings] = await Promise.all([
            query(`SELECT COUNT(*) AS cnt FROM bookings WHERE tenant_id=$1 AND status='confirmed'`, [tenantId]),
            query(`SELECT COUNT(*) AS cnt FROM bookings WHERE tenant_id=$1 AND status='cancelled'`, [tenantId]),
            query(`SELECT COUNT(*) AS cnt FROM design_inquiries WHERE tenant_id=$1 AND status='new'`, [tenantId]),
            query(`SELECT COUNT(*) AS cnt FROM design_inquiries WHERE tenant_id=$1`, [tenantId]),
            query(`SELECT COUNT(*) AS cnt FROM unavailable_slots WHERE tenant_id=$1`, [tenantId]),
            query(
                `SELECT COUNT(*) AS cnt FROM bookings WHERE tenant_id=$1 AND status='confirmed'
                 AND booking_date >= date_trunc('month', NOW())`,
                [tenantId]
            )
        ]);

        res.json({
            confirmedBookings: parseInt(confirmed.rows[0].cnt),
            cancelledBookings: parseInt(cancelled.rows[0].cnt),
            newDesigns:        parseInt(newDesigns.rows[0].cnt),
            totalDesigns:      parseInt(totalDesigns.rows[0].cnt),
            activeBlocks:      parseInt(activeBlocks.rows[0].cnt),
            monthlyBookings:   parseInt(monthlyBookings.rows[0].cnt),
            plan:              req.tenant.plan_id,
            tenantName:        req.tenant.name
        });
    } catch (err) {
        console.error('[Admin/Summary]', err.message);
        res.status(500).json({ error: 'Failed to fetch summary.' });
    }
});

// ── Availability / Blocking ────────────────────────────────────────────────────
// GET /api/v1/admin/unavailable
router.get('/unavailable', async (req, res) => {
    const { year, month } = req.query;
    const tenantId = req.tenant.id;

    let sql    = `SELECT * FROM unavailable_slots WHERE tenant_id=$1`;
    let params = [tenantId];

    if (year && month) {
        const paddedMonth = String(month).padStart(2, '0');
        sql    += ` AND block_date::TEXT LIKE $2`;
        params.push(`${year}-${paddedMonth}%`);
    }

    sql += ` ORDER BY block_date ASC, block_time ASC`;

    try {
        const result = await query(sql, params);
        res.json({ blocks: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch availability blocks.' });
    }
});

// POST /api/v1/admin/unavailable
router.post('/unavailable', async (req, res) => {
    const { block_type, block_date, block_time, reason } = req.body;
    const tenantId = req.tenant.id;

    if (!block_type || !block_date) {
        return res.status(400).json({ error: 'block_type and block_date are required.' });
    }
    if (!['day', 'slot'].includes(block_type)) {
        return res.status(400).json({ error: 'block_type must be "day" or "slot".' });
    }
    if (block_type === 'slot' && !block_time) {
        return res.status(400).json({ error: 'block_time is required for slot blocks.' });
    }

    const sanitizedReason = reason
        ? reason.substring(0, 200).replace(/[<>&"']/g, '')
        : null;

    try {
        const result = await query(
            `INSERT INTO unavailable_slots (tenant_id, block_type, block_date, block_time, reason)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [tenantId, block_type, block_date, block_type === 'day' ? null : block_time, sanitizedReason]
        );
        res.status(201).json({ success: true, block: result.rows[0] });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'This block already exists.' });
        res.status(500).json({ error: 'Failed to create availability block.' });
    }
});

// DELETE /api/v1/admin/unavailable/:id
router.delete('/unavailable/:id', async (req, res) => {
    try {
        const result = await query(
            `DELETE FROM unavailable_slots WHERE id = $1 AND tenant_id = $2 RETURNING id`,
            [req.params.id, req.tenant.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Block not found.' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete block.' });
    }
});

// ── Design Inquiries ──────────────────────────────────────────────────────────
// GET /api/v1/admin/designs
router.get('/designs', async (req, res) => {
    const { status, search, page = 1, limit = 50 } = req.query;
    const tenantId = req.tenant.id;
    const offset   = (parseInt(page) - 1) * parseInt(limit);

    const conditions = ['tenant_id = $1'];
    const params     = [tenantId];
    let p = 2;

    if (status) { conditions.push(`status = $${p++}`); params.push(status); }
    if (search) {
        conditions.push(`(customer_name ILIKE $${p} OR customer_email ILIKE $${p} OR design_name ILIKE $${p})`);
        params.push(`%${search}%`); p++;
    }

    const where = conditions.join(' AND ');

    try {
        const [rows, total] = await Promise.all([
            query(
                `SELECT * FROM design_inquiries WHERE ${where}
                 ORDER BY created_at DESC LIMIT $${p} OFFSET $${p + 1}`,
                [...params, parseInt(limit), offset]
            ),
            query(`SELECT COUNT(*) AS cnt FROM design_inquiries WHERE ${where}`, params)
        ]);

        res.json({
            designs: rows.rows,
            total:   parseInt(total.rows[0].cnt),
            page:    parseInt(page),
            limit:   parseInt(limit)
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch design inquiries.' });
    }
});

// PATCH /api/v1/admin/designs/:id/status
router.patch('/designs/:id/status', async (req, res) => {
    const { status } = req.body;
    const validStatuses = ['new', 'reviewed', 'in_progress', 'completed'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}.` });
    }
    try {
        const result = await query(
            `UPDATE design_inquiries SET status=$1 WHERE id=$2 AND tenant_id=$3 RETURNING *`,
            [status, req.params.id, req.tenant.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Inquiry not found.' });
        res.json({ success: true, design: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update design inquiry status.' });
    }
});

// ── Audit Log ──────────────────────────────────────────────────────────────────
// GET /api/v1/admin/audit
router.get('/audit', requireRole('tenant_admin', 'super_admin'), async (req, res) => {
    const { limit = 100 } = req.query;
    try {
        const result = await query(
            `SELECT a.*, u.email AS user_email FROM audit_log a
             LEFT JOIN users u ON u.id = a.user_id
             WHERE a.tenant_id = $1
             ORDER BY a.created_at DESC LIMIT $2`,
            [req.tenant.id, parseInt(limit)]
        );
        res.json({ logs: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch audit log.' });
    }
});

module.exports = router;
