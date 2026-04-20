/**
 * Orders Routes — /api/v1/orders
 * Multi-tenant order management (custom suit orders).
 */

const express = require('express');
const router  = express.Router();
const { query }  = require('../../db/connection');
const { authenticate, requireRole } = require('../../middleware/auth');

// POST /api/v1/orders/draft — Create draft order
router.post('/draft', async (req, res) => {
    const { suitId, gender, measurements, pricingData } = req.body;
    const tenantId  = req.tenant.id;
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
        const orderResult = await query(
            `INSERT INTO orders (tenant_id, session_id, status) VALUES ($1, $2, 'draft') RETURNING id`,
            [tenantId, sessionId]
        );
        const orderId = orderResult.rows[0].id;

        await query(
            `INSERT INTO order_items (tenant_id, order_id, suit_name, gender, measurements)
             VALUES ($1, $2, $3, $4, $5)`,
            [tenantId, orderId, suitId, gender, JSON.stringify({ ...measurements, _pricing: pricingData })]
        );

        res.status(201).json({ sessionId, orderId });
    } catch (err) {
        console.error('[Orders/Draft]', err.message);
        res.status(500).json({ error: 'Failed to create order session.' });
    }
});

// POST /api/v1/orders/shipping — Update draft order with shipping info
router.post('/shipping', async (req, res) => {
    const { sessionId, shipping } = req.body;
    const tenantId = req.tenant.id;

    if (!sessionId || !shipping) {
        return res.status(400).json({ error: 'sessionId and shipping object are required.' });
    }

    const { name, email, phone, address, city, country } = shipping;

    try {
        const result = await query(
            `UPDATE orders SET customer_name=$1, customer_email=$2, customer_phone=$3,
             shipping_address=$4, city=$5, country=$6
             WHERE session_id=$7 AND tenant_id=$8 RETURNING id`,
            [name, email, phone, address, city, country, sessionId, tenantId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Order session not found.' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update shipping info.' });
    }
});

// GET /api/v1/orders — List orders for tenant (admin)
router.get('/', authenticate, requireRole('staff', 'tenant_admin'), async (req, res) => {
    const { status, page = 1, limit = 50 } = req.query;
    const tenantId = req.tenant.id;
    const offset   = (parseInt(page) - 1) * parseInt(limit);

    const conditions = ['o.tenant_id = $1'];
    const params     = [tenantId];
    let p = 2;

    if (status) { conditions.push(`o.status = $${p++}`); params.push(status); }

    const where = conditions.join(' AND ');

    try {
        const result = await query(
            `SELECT o.*, COUNT(oi.id) AS item_count
             FROM orders o
             LEFT JOIN order_items oi ON oi.order_id = o.id
             WHERE ${where}
             GROUP BY o.id
             ORDER BY o.created_at DESC
             LIMIT $${p} OFFSET $${p + 1}`,
            [...params, parseInt(limit), offset]
        );
        res.json({ orders: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch orders.' });
    }
});

// GET /api/v1/orders/:sessionId — Get order by session
router.get('/:sessionId', async (req, res) => {
    const tenantId = req.tenant.id;
    try {
        const [orderResult, itemsResult] = await Promise.all([
            query(`SELECT * FROM orders WHERE session_id=$1 AND tenant_id=$2`, [req.params.sessionId, tenantId]),
            query(
                `SELECT oi.* FROM order_items oi
                 JOIN orders o ON o.id = oi.order_id
                 WHERE o.session_id=$1 AND o.tenant_id=$2`,
                [req.params.sessionId, tenantId]
            )
        ]);
        if (orderResult.rows.length === 0) return res.status(404).json({ error: 'Order not found.' });
        res.json({ order: orderResult.rows[0], items: itemsResult.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch order.' });
    }
});

module.exports = router;
