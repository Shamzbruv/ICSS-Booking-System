/**
 * Services Management Routes — /api/v1/services
 * Create, edit, and delete services for a tenant.
 */

const express = require('express');
const router  = express.Router();
const { query }  = require('../../db/connection');
const { authenticate, requireRole } = require('../../middleware/auth');

router.use(authenticate);
router.use(requireRole('staff', 'tenant_admin'));

// GET /api/v1/services
router.get('/', async (req, res) => {
    try {
        const result = await query(
            `SELECT * FROM services WHERE tenant_id = $1 ORDER BY created_at ASC`,
            [req.tenant.id]
        );
        res.json({ services: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch services.' });
    }
});

// POST /api/v1/services
router.post('/', async (req, res) => {
    const { 
        name, description, image_url, duration_minutes, buffer_time_minutes, price, currency,
        payment_mode, payment_requirement_type, deposit_type, deposit_amount 
    } = req.body;

    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required.' });

    try {
        const result = await query(
            `INSERT INTO services (
                tenant_id, name, description, image_url, duration_minutes, buffer_time_minutes,
                price, currency, payment_mode, payment_requirement_type, deposit_type, deposit_amount
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
            [
                req.tenant.id,
                name.trim(),
                description || null,
                image_url || null,
                parseInt(duration_minutes) || 30,
                parseInt(buffer_time_minutes) || 0,
                parseFloat(price) || 0,
                currency || 'JMD',
                payment_mode || 'tenant_default',
                payment_requirement_type || 'none',
                deposit_type || 'percentage',
                parseFloat(deposit_amount) || 0
            ]
        );
        res.status(201).json({ success: true, service: result.rows[0] });
    } catch (err) {
        console.error('[Services/Create] DB Error:', err.message, '| Code:', err.code);
        if (err.code === '42703') {
            return res.status(500).json({ error: `Database column missing: ${err.message}` });
        }
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

// PATCH /api/v1/services/:id
router.patch('/:id', async (req, res) => {
    const { 
        name, description, image_url, duration_minutes, buffer_time_minutes, price, currency,
        payment_mode, payment_requirement_type, deposit_type, deposit_amount, active
    } = req.body;

    try {
        const result = await query(
            `UPDATE services SET
                name = COALESCE($1, name),
                description = COALESCE($2, description),
                image_url = $3,
                duration_minutes = COALESCE($4, duration_minutes),
                buffer_time_minutes = COALESCE($5, buffer_time_minutes),
                price = COALESCE($6, price),
                currency = COALESCE($7, currency),
                payment_mode = COALESCE($8, payment_mode),
                payment_requirement_type = COALESCE($9, payment_requirement_type),
                deposit_type = COALESCE($10, deposit_type),
                deposit_amount = COALESCE($11, deposit_amount),
                active = COALESCE($12, active)
             WHERE id = $13 AND tenant_id = $14 RETURNING *`,
            [
                name ? name.trim() : null,
                description !== undefined ? description : null,
                image_url !== undefined ? image_url : null,
                duration_minutes ? parseInt(duration_minutes) : null,
                buffer_time_minutes !== undefined ? parseInt(buffer_time_minutes) : null,
                price !== undefined ? parseFloat(price) : null,
                currency || null,
                payment_mode || null,
                payment_requirement_type || null,
                deposit_type || null,
                deposit_amount !== undefined ? parseFloat(deposit_amount) : null,
                active !== undefined ? Boolean(active) : null,
                req.params.id, req.tenant.id
            ]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Service not found.' });
        res.json({ success: true, service: result.rows[0] });
    } catch (err) {
        console.error('[Services/Update] DB Error:', err.message, '| Code:', err.code);
        if (err.code === '42703') {
            return res.status(500).json({ error: `Database column missing: ${err.message}` });
        }
        res.status(500).json({ error: 'An internal server error occurred.' });
    }
});

// DELETE /api/v1/services/:id
router.delete('/:id', async (req, res) => {
    try {
        // Attempt to delete the service. If there are bookings tied to it, we might want to prevent it or set them to null.
        // Assuming we just hard-delete it if no foreign key cascade issues exist, or catch the constraint error.
        const result = await query(
            `DELETE FROM services WHERE id = $1 AND tenant_id = $2 RETURNING id`,
            [req.params.id, req.tenant.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Service not found.' });
        res.json({ success: true, message: 'Service deleted successfully.' });
    } catch (err) {
        if (err.code === '23503') { // Foreign key violation
            return res.status(409).json({ error: 'Cannot delete service because it is currently linked to existing bookings.' });
        }
        res.status(500).json({ error: 'Failed to delete service.' });
    }
});

module.exports = router;
