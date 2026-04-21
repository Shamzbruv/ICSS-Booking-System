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
const { enqueueProvisioningJob } = require('../../services/provisioning');

// POST /api/v1/payments/stripe/webhook
router.post('/stripe/webhook', async (req, res) => {
    try {
        const stripeEvent = req.body;
        const { handleStripeWebhookEvent } = require('../../services/subscription');
        await handleStripeWebhookEvent(stripeEvent);
        res.json({received: true});
    } catch (e) {
        console.error(e);
        res.status(400).send(`Webhook Error: ${e.message}`);
    }
});

// Helper to simulate PayPal Webhook Signature Verification
async function verifyPayPalWebhookSignature(req) {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (!webhookId) {
        console.warn('[PayPal Webhook] PAYPAL_WEBHOOK_ID missing. Skipping signature verification in Dev.');
        return true; 
    }
    
    const transmissionId = req.headers['paypal-transmission-id'];
    const transmissionTime = req.headers['paypal-transmission-time'];
    const certUrl = req.headers['paypal-cert-url'];
    const authAlgo = req.headers['paypal-auth-algo'];
    const transmissionSig = req.headers['paypal-transmission-sig'];

    if (!transmissionId || !transmissionTime || !certUrl || !transmissionSig) {
        throw new Error('Missing PayPal signature headers');
    }

    // In a real production app using @paypal/checkout-server-sdk, you would:
    // 1. Construct the string: transmissionId | transmissionTime | webhookId | crc32(payload)
    // 2. Fetch the cert from certUrl, use the public key and authAlgo to verify transmissionSig
    console.log(`[PayPal] Verifying signature for webhook ${webhookId}... (Mock verification successful)`);
    return true; 
}

// POST /api/v1/payments/paypal/webhook
router.post('/paypal/webhook', async (req, res) => {
    try {
        await verifyPayPalWebhookSignature(req);

        const paypalEvent = req.body;
        const { handlePayPalWebhookEvent } = require('../../services/subscription');
        await handlePayPalWebhookEvent(paypalEvent);

        // Also enqueue a provisioning job in case this is a CREATED / ACTIVATED event
        if (paypalEvent.event_type === 'BILLING.SUBSCRIPTION.ACTIVATED' || paypalEvent.event_type === 'BILLING.SUBSCRIPTION.CREATED') {
             const custom_id = paypalEvent.resource?.custom_id; // This is now our signup_token
             if (custom_id) {
                 // Custom ID is the signup_token.
                 // We don't try to parse it as JSON. We just enqueue it securely.
                 try {
                     const pendingRes = await query(`SELECT tenant_slug FROM pending_signups WHERE signup_token = $1`, [custom_id]);
                     if (pendingRes.rows.length > 0) {
                         const slug = pendingRes.rows[0].tenant_slug || null;
                         await enqueueProvisioningJob(slug, custom_id, paypalEvent.id, paypalEvent.resource);
                     } else {
                         console.error(`[PayPal Webhook] signup_token ${custom_id} not found in pending_signups.`);
                     }
                 } catch (err) {
                     console.error('[PayPal Webhook] DB error queuing provision lookup', err);
                 }
             }
        }
        res.json({received: true});
    } catch (e) {
        console.error(e);
        res.status(400).send(`Webhook Error: ${e.message}`);
    }
});

// POST /api/v1/payments/paypal/create-subscription
// This endpoint is used by the frontend setup form to securely lodge the tenant config,
// generate a token, and return it. The frontend will pass this token to the PayPal JS SDK.
router.post('/paypal/create-subscription', async (req, res) => {
    try {
        const {
            tenant_name, admin_email, admin_password,
            theme_id, plan_id
        } = req.body;

        if (!tenant_name || !admin_email || !admin_password) {
            return res.status(400).json({ error: 'Missing required onboarding fields.' });
        }

        const bcrypt = require('bcryptjs');
        const hash = await bcrypt.hash(admin_password, 12);
        
        const signup_token = crypto.randomUUID();

        await query(
            `INSERT INTO pending_signups (signup_token, tenant_slug, tenant_name, admin_email, admin_password_hash, theme_id, plan_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [signup_token, null, tenant_name, admin_email.toLowerCase(), hash, theme_id || null, plan_id || 'starter']
        );

        res.json({
            message: 'Pending signup created successfully. Pass this token as custom_id to PayPal checkout.',
            signup_token,
            paypal_client_id: process.env.PAYPAL_CLIENT_ID || 'sb'
        });
    } catch (e) {
        console.error('[Create Subscription Error]', e);
        if (e.code === '23505') { // Unique violation
            return res.status(400).json({ error: 'Tenant slug already exists.' });
        }
        res.status(500).json({ error: 'Internal server error.' });
    }
});

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

        // Send order confirmation email with PDF invoice (async)
        try {
            const { sendOrderConfirmation } = require('../../services/email');
            const itemsResult = await query(
                `SELECT * FROM order_items WHERE order_id = $1`, [order.id]
            );
            sendOrderConfirmation(
                { ...order, status: 'paid', payment_ref: txnId },
                itemsResult.rows,
                req.tenant
            ).catch(console.error);
        } catch (emailErr) {
            console.error('[Payments] Email dispatch error:', emailErr.message);
        }

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
