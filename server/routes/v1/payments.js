/**
 * Payments Routes — /api/v1/payments
 * WiPay (Jamaica) + Stripe-ready structure
 * Ported from Windross with full multi-tenant support.
 */

const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const { query }  = require('../../db/connection');
const { paymentLimiter } = require('../../middleware/rateLimiter');

// POST /api/v1/payments/wipay/create
router.post('/wipay/create', paymentLimiter, async (req, res) => {
    const { sessionId, total, currency, returnPath } = req.body;
    const tenantId = req.tenant.id;

    if (!sessionId || !total) {
        return res.status(400).json({ error: 'sessionId and total are required.' });
    }

    try {
        await query(
            `UPDATE orders SET total_amount = $1, currency = $2 WHERE session_id = $3 AND tenant_id = $4`,
            [parseFloat(total), currency || 'JMD', sessionId, tenantId]
        );

        // Use tenant-specific WiPay credentials if configured, fall back to platform defaults
        const wipayAccount = req.tenant.branding?.wipay_account || process.env.WIPAY_ACCOUNT_NUMBER || '1234567890';
        const wipayEnv     = process.env.WIPAY_ENVIRONMENT || 'sandbox';
        const baseUrl      = req.headers.origin || `${req.protocol}://${req.get('host')}`;
        const responseUrl  = returnPath
            ? `${baseUrl}/${returnPath}`
            : `${baseUrl}/`;

        res.json({
            actionUrl: 'https://jm.wipayfinancial.com/plugins/payments/request',
            params: {
                account_number: wipayAccount,
                country_code:   'JM',
                currency:       currency || 'JMD',
                environment:    wipayEnv,
                fee_structure:  'customer_pay',
                method:         'credit_card',
                order_id:       sessionId,
                origin:         req.tenant.name.replace(/\s+/g, '_'),
                response_url:   responseUrl,
                total:          parseFloat(total).toFixed(2)
            }
        });
    } catch (err) {
        console.error('[Payments/WiPay/Create]', err.message);
        res.status(500).json({ error: 'Failed to create payment session.' });
    }
});

// POST /api/v1/payments/wipay/verify
router.post('/wipay/verify', paymentLimiter, async (req, res) => {
    const { sessionId, txnId, hash } = req.body;
    const tenantId = req.tenant.id;

    if (!sessionId) return res.status(400).json({ error: 'sessionId is required.' });

    try {
        const orderResult = await query(
            `SELECT * FROM orders WHERE session_id = $1 AND tenant_id = $2`,
            [sessionId, tenantId]
        );
        if (orderResult.rows.length === 0) return res.status(404).json({ error: 'Order not found.' });

        const order    = orderResult.rows[0];
        const apiKey   = process.env.WIPAY_API_KEY;
        const total    = parseFloat(order.total_amount).toFixed(2);

        // ── Hash Verification ─────────────────────────────────────────────────
        let validHash = false;
        if (hash && apiKey && txnId) {
            const checks = [
                crypto.createHash('md5').update(txnId + total + apiKey).digest('hex'),
                crypto.createHash('md5').update(sessionId + txnId + apiKey).digest('hex'),
                crypto.createHash('md5').update(txnId + apiKey).digest('hex'),
                crypto.createHash('md5').update(sessionId + total + apiKey).digest('hex'),
            ];
            validHash = checks.includes(hash);
        } else if (!apiKey) {
            // In dev/sandbox mode with no API key, allow verification
            validHash = true;
            console.warn('[Payments] WIPAY_API_KEY not set — skipping hash check (dev mode).');
        }

        if (!validHash) {
            console.error(`[Payments] Hash mismatch for session ${sessionId}`);
            return res.status(403).json({ error: 'Payment verification failed: invalid transaction hash.' });
        }

        // Mark order as paid
        await query(
            `UPDATE orders SET status = 'paid', payment_ref = $1 WHERE id = $2`,
            [txnId || 'verified', order.id]
        );

        // Log payment record
        await query(
            `INSERT INTO payments (tenant_id, order_id, provider, transaction_id, amount, currency, status)
             VALUES ($1, $2, 'wipay', $3, $4, $5, 'paid')`,
            [tenantId, order.id, txnId || 'verified', order.total_amount, order.currency]
        );

        res.json({ success: true, orderId: order.id });

    } catch (err) {
        console.error('[Payments/WiPay/Verify]', err.message);
        res.status(500).json({ error: 'Payment verification error.' });
    }
});

// POST /api/v1/payments/deposit/create — Design deposit (fixed amount)
router.post('/deposit/create', paymentLimiter, async (req, res) => {
    const { customerName, customerEmail, customerPhone, designData } = req.body;
    const tenantId = req.tenant.id;

    if (!customerName || !customerEmail) {
        return res.status(400).json({ error: 'customerName and customerEmail are required.' });
    }

    const depositId = `dep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const amount    = 30000; // J$30,000 — configurable via tenant settings in future
    const currency  = 'JMD';

    try {
        await query(
            `INSERT INTO deposit_sessions (tenant_id, deposit_id, customer_name, customer_email, customer_phone, design_data, amount, currency)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [tenantId, depositId, customerName, customerEmail, customerPhone || '', JSON.stringify(designData || {}), amount, currency]
        );

        const wipayAccount = req.tenant.branding?.wipay_account || process.env.WIPAY_ACCOUNT_NUMBER || '1234567890';
        const baseUrl      = req.headers.origin || `${req.protocol}://${req.get('host')}`;

        res.json({
            depositId,
            actionUrl: 'https://jm.wipayfinancial.com/plugins/payments/request',
            params: {
                account_number: wipayAccount,
                country_code:   'JM',
                currency,
                environment:    process.env.WIPAY_ENVIRONMENT || 'sandbox',
                fee_structure:  'customer_pay',
                method:         'credit_card',
                order_id:       depositId,
                origin:         `${req.tenant.name.replace(/\s+/g, '_')}_Deposit`,
                response_url:   `${baseUrl}/`,
                total:          parseFloat(amount).toFixed(2)
            }
        });
    } catch (err) {
        console.error('[Payments/Deposit/Create]', err.message);
        res.status(500).json({ error: 'Failed to create deposit session.' });
    }
});

// POST /api/v1/payments/deposit/verify
router.post('/deposit/verify', paymentLimiter, async (req, res) => {
    const { depositId, transactionId, hash } = req.body;
    const tenantId = req.tenant.id;

    if (!depositId) return res.status(400).json({ error: 'depositId is required.' });

    try {
        const result = await query(
            `SELECT * FROM deposit_sessions WHERE deposit_id = $1 AND tenant_id = $2`,
            [depositId, tenantId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Deposit session not found.' });

        const session = result.rows[0];
        if (session.status === 'paid') return res.json({ success: true, alreadyPaid: true });

        // Hash check
        const apiKey = process.env.WIPAY_API_KEY;
        let validHash = false;
        if (hash && apiKey && transactionId) {
            const total  = parseFloat(session.amount).toFixed(2);
            const checks = [
                crypto.createHash('md5').update(transactionId + total + apiKey).digest('hex'),
                crypto.createHash('md5').update(depositId + transactionId + apiKey).digest('hex'),
                crypto.createHash('md5').update(transactionId + apiKey).digest('hex'),
            ];
            validHash = checks.includes(hash);
        } else if (!apiKey) {
            validHash = true;
        }

        if (!validHash) {
            return res.status(403).json({ error: 'Deposit verification failed: invalid hash.' });
        }

        await query(
            `UPDATE deposit_sessions SET status = 'paid', payment_ref = $1 WHERE deposit_id = $2`,
            [transactionId || 'verified', depositId]
        );

        res.json({ success: true });
    } catch (err) {
        console.error('[Payments/Deposit/Verify]', err.message);
        res.status(500).json({ error: 'Deposit verification error.' });
    }
});

module.exports = router;
