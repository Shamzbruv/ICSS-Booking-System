/**
 * Themes Routes — /api/v1/themes
 * List available templates/starter kits and handle custom theme requests.
 */

const express = require('express');
const router = express.Router();
const { query } = require('../../db/connection');
const { authenticate } = require('../../middleware/auth');

// GET /api/v1/themes - Publicly readable list of available starter kits
router.get('/', async (req, res) => {
    try {
        const result = await query(
            `SELECT id, name, category, preview_image_url, template_path, visual_config, business_config 
             FROM themes ORDER BY category ASC, name ASC`
        );
        res.json({ themes: result.rows });
    } catch (err) {
        console.error('[Themes/List]', err.message);
        res.status(500).json({ error: 'Failed to fetch themes.' });
    }
});

// POST /api/v1/themes/custom-request - Authenticated endpoint for a tenant to request custom work
router.post('/custom-request', authenticate, async (req, res) => {
    const { notes } = req.body;
    const tenantId = req.tenant.id;

    if (!notes || notes.trim().length === 0) {
        return res.status(400).json({ error: 'Please provide notes describing your custom theme requirements.' });
    }

    try {
        const result = await query(
            `INSERT INTO custom_theme_requests (tenant_id, notes, status, deposit_required)
             VALUES ($1, $2, 'pending', true) RETURNING *`,
            [tenantId, notes]
        );
        res.status(201).json({ 
            success: true, 
            request: result.rows[0],
            message: 'Custom theme request submitted. Our team will review and provide a quote soon.'
        });
    } catch (err) {
        console.error('[Themes/CustomRequest]', err.message);
        res.status(500).json({ error: 'Failed to submit custom theme request.' });
    }
});

// PATCH /api/v1/themes/requests/:id - Admin endpoint to manage workflow of requests
// Requires platform admin authorization
router.patch('/requests/:id', async (req, res) => {
    // In a real application, ensure `req` is authenticated as a platform admin via a middleware.
    // For MVP, we will assume a platform_admin_key check or similar.
    const platformAdminKey = req.headers['x-platform-admin-key'];
    if (platformAdminKey !== process.env.PLATFORM_ADMIN_KEY && process.env.NODE_ENV !== 'development') {
        return res.status(403).json({ error: 'Forbidden: Admin access required.' });
    }

    const { id } = req.params;
    const { 
        status, 
        quoted_price, 
        final_price, 
        approved_scope, 
        assigned_developer, 
        delivery_status, 
        payment_state,
        deposit_paid
    } = req.body;

    try {
        const result = await query(
            `UPDATE custom_theme_requests 
             SET 
               status = COALESCE($1, status),
               quoted_price = COALESCE($2, quoted_price),
               final_price = COALESCE($3, final_price),
               approved_scope = COALESCE($4, approved_scope),
               assigned_developer = COALESCE($5, assigned_developer),
               delivery_status = COALESCE($6, delivery_status),
               payment_state = COALESCE($7, payment_state),
               deposit_paid = COALESCE($8, deposit_paid),
               updated_at = NOW()
             WHERE id = $9 RETURNING *`,
            [status, quoted_price, final_price, approved_scope, assigned_developer, delivery_status, payment_state, deposit_paid, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Theme request not found.' });
        }

        res.json({ success: true, request: result.rows[0] });
    } catch (err) {
        console.error('[Themes/AdminUpdate]', err.message);
        res.status(500).json({ error: 'Failed to update custom theme request.' });
    }
});

module.exports = router;
