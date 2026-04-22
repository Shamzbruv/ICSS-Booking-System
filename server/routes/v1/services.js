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
        name, description, duration_minutes, buffer_time_minutes, price, currency,
        payment_mode, payment_requirement_type, deposit_type, deposit_amount 
    } = req.body;

    if (!name) return res.status(400).json({ error: 'Name is required.' });

    try {
        const result = await query(
            `INSERT INTO services (
                tenant_id, name, description, duration_minutes, buffer_time_minutes,
                price, currency, payment_mode, payment_requirement_type, deposit_type, deposit_amount
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
            [
                req.tenant.id, name, description, duration_minutes || 30, buffer_time_minutes || 0,
                price || 0, currency || 'JMD', payment_mode || 'tenant_default', 
                payment_requirement_type || 'none', deposit_type || 'percentage', deposit_amount || 0
            ]
        );
        res.status(201).json({ success: true, service: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create service.' });
    }
});

// PATCH /api/v1/services/:id
router.patch('/:id', async (req, res) => {
    const { 
        name, description, duration_minutes, buffer_time_minutes, price, currency,
        payment_mode, payment_requirement_type, deposit_type, deposit_amount, active
    } = req.body;

    try {
        const result = await query(
            `UPDATE services SET
                name = COALESCE($1, name),
                description = COALESCE($2, description),
                duration_minutes = COALESCE($3, duration_minutes),
                buffer_time_minutes = COALESCE($4, buffer_time_minutes),
                price = COALESCE($5, price),
                currency = COALESCE($6, currency),
                payment_mode = COALESCE($7, payment_mode),
                payment_requirement_type = COALESCE($8, payment_requirement_type),
                deposit_type = COALESCE($9, deposit_type),
                deposit_amount = COALESCE($10, deposit_amount),
                active = COALESCE($11, active)
             WHERE id = $12 AND tenant_id = $13 RETURNING *`,
            [
                name, description, duration_minutes, buffer_time_minutes, price, currency,
                payment_mode, payment_requirement_type, deposit_type, deposit_amount, active,
                req.params.id, req.tenant.id
            ]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Service not found.' });
        res.json({ success: true, service: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update service.' });
    }
});

module.exports = router;
