/**
 * Payments Routes — /api/v1/payments
 * WiPay (Jamaica) + Stripe-ready structure
 * Ported from Windross with full multi-tenant support.
 */

const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const https   = require('https');
const { query }  = require('../../db/connection');
const { paymentLimiter } = require('../../middleware/rateLimiter');
const { enqueueProvisioningJob } = require('../../services/provisioning');
const { sendSignupWelcomeEmail } = require('../../services/email');
const { getPayPalSignupConfig, normalizeInternalSignupPlanId } = require('../../services/paypalConfig');

// Helper to enforce webhook idempotency
async function checkIdempotency(provider, eventId, payload) {
    if (!eventId) return true; // Cannot verify
    try {
        await query(
            `INSERT INTO idempotency_keys (provider, event_id, payload) VALUES ($1, $2, $3)`,
            [provider, eventId, JSON.stringify(payload || {})]
        );
        return true; // Successfully inserted, proceed
    } catch (e) {
        if (e.code === '23505') { // Unique constraint violation
            return false; // Already processed
        }
        throw e;
    }
}

async function sendSignupWelcomeEmailOnce(signupToken, signupConfig = getPayPalSignupConfig()) {
    if (!signupToken) return false;

    const lockRes = await query(
        `INSERT INTO idempotency_keys (provider, event_id, payload)
         VALUES ('signup_welcome_email', $1, $2)
         ON CONFLICT (provider, event_id) DO NOTHING
         RETURNING id`,
        [signupToken, JSON.stringify({ type: 'signup_welcome_email' })]
    );

    if (lockRes.rows.length === 0) {
        return false;
    }

    try {
        const pendingRes = await query(
            `SELECT admin_email, admin_owner_name, tenant_name
             FROM pending_signups
             WHERE signup_token = $1`,
            [signupToken]
        );

        if (pendingRes.rows.length === 0) {
            await query(
                `DELETE FROM idempotency_keys
                 WHERE provider = 'signup_welcome_email' AND event_id = $1`,
                [signupToken]
            );
            return false;
        }

        const signup = pendingRes.rows[0];

        await sendSignupWelcomeEmail(
            signup.admin_email,
            (signup.admin_owner_name || signup.admin_email).split(' ')[0],
            signup.tenant_name,
            {
                trialDays: signupConfig.trialDays,
                monthlyPriceUsd: signupConfig.monthlyPriceUsd
            }
        );

        return true;
    } catch (err) {
        try {
            await query(
                `DELETE FROM idempotency_keys
                 WHERE provider = 'signup_welcome_email' AND event_id = $1`,
                [signupToken]
            );
        } catch (cleanupErr) {
            console.error('[Signup Welcome Email] Failed to release idempotency lock:', cleanupErr.message);
        }
        throw err;
    }
}

// POST /api/v1/payments/stripe/webhook
router.post('/stripe/webhook', async (req, res) => {
    try {
        const stripeEvent = req.body;
        
        const isNew = await checkIdempotency('stripe', stripeEvent.id, stripeEvent);
        if (!isNew) {
            console.log(`[Stripe Webhook] Duplicate event ${stripeEvent.id} ignored.`);
            return res.json({ received: true, duplicate: true });
        }

        const { handleStripeWebhookEvent } = require('../../services/subscription');
        await handleStripeWebhookEvent(stripeEvent);
        res.json({received: true});
    } catch (e) {
        console.error('[Stripe Webhook Error]', e);
        const isValidation = e.message.includes('signature') || e.message.includes('payload');
        res.status(isValidation ? 400 : 500).send(`Webhook Error: ${e.message}`);
    }
});

// ── PayPal Webhook Signature Verification ─────────────────────────────────────
// Implements PayPal's CRC32-based verification algorithm:
// https://developer.paypal.com/docs/api-basics/notifications/webhooks/notification-messages/

/**
 * Compute CRC32 of a buffer. Used as part of PayPal's signature check.
 */
function crc32(buf) {
    const table = [];
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        table.push(c >>> 0);
    }
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
        crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
    }
    return ((crc ^ 0xFFFFFFFF) >>> 0);
}

/**
 * Fetch a PEM certificate from a URL (PayPal cert endpoint).
 */
function fetchCert(url) {
    return new Promise((resolve, reject) => {
        if (!url.startsWith('https://www.paypalobjects.com') && !url.startsWith('https://api.paypal.com')) {
            return reject(new Error('Untrusted cert URL: ' + url));
        }
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function verifyPayPalWebhookSignature(req) {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (!webhookId) {
        console.warn('[PayPal Webhook] PAYPAL_WEBHOOK_ID missing — skipping signature check in Dev.');
        return true;
    }

    const transmissionId   = req.headers['paypal-transmission-id'];
    const transmissionTime = req.headers['paypal-transmission-time'];
    const certUrl          = req.headers['paypal-cert-url'];
    const authAlgo         = req.headers['paypal-auth-algo'];
    const transmissionSig  = req.headers['paypal-transmission-sig'];

    if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
        throw new Error('Missing required PayPal webhook signature headers.');
    }

    // Step 1: Compute CRC32 of the raw body
    const rawBody = req.rawBody || JSON.stringify(req.body);
    const bodyCrc32 = crc32(Buffer.from(rawBody)).toString();

    // Step 2: Build the verification string
    const verificationString = `${transmissionId}|${transmissionTime}|${webhookId}|${bodyCrc32}`;

    // Step 3: Fetch the PayPal certificate and extract the public key
    const certPem = await fetchCert(certUrl);

    // Step 4: Verify the signature against the verification string
    const sigBuffer  = Buffer.from(transmissionSig, 'base64');
    const hashAlgo   = authAlgo.replace('withRSA', '').replace('RSA-', '').toLowerCase();
    const isValid    = crypto.createVerify(hashAlgo)
        .update(verificationString)
        .verify(certPem, sigBuffer);

    if (!isValid) {
        throw new Error('PayPal webhook signature verification FAILED. Possible forgery attempt.');
    }

    console.log('[PayPal Webhook] Signature verified successfully.');
    return true;
}

// POST /api/v1/payments/paypal/webhook
router.post('/paypal/webhook', async (req, res) => {
    try {
        await verifyPayPalWebhookSignature(req);

        const paypalEvent = req.body;
        
        const isNew = await checkIdempotency('paypal', paypalEvent.id, paypalEvent);
        if (!isNew) {
            console.log(`[PayPal Webhook] Duplicate event ${paypalEvent.id} ignored.`);
            return res.json({ received: true, duplicate: true });
        }

        const { handlePayPalWebhookEvent } = require('../../services/subscription');
        await handlePayPalWebhookEvent(paypalEvent);

        // Enqueue to pg-boss for double-entry ledger processing (Phase 2)
        const { enqueue } = require('../../services/queue');
        await enqueue('paypal-webhooks', paypalEvent);

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
                         await sendSignupWelcomeEmailOnce(custom_id).catch((err) => {
                             console.error('[PayPal Webhook] Failed to send signup welcome email:', err.message);
                         });
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
        console.error('[PayPal Webhook Error]', e);
        // Differentiate between 400 validation errors and 500 processing errors
        const isValidation = e.message.includes('signature') || e.message.includes('Missing required') || e.message.includes('forgery');
        res.status(isValidation ? 400 : 500).send(`Webhook Error: ${e.message}`);
    }
});

// POST /api/v1/payments/paypal/approve
// Manual trigger from frontend to ensure provisioning starts immediately
// without waiting for the async webhook (which might fail locally).
router.post('/paypal/approve', async (req, res) => {
    try {
        const { signup_token, subscription_id } = req.body;
        if (!signup_token) return res.status(400).json({ error: 'Missing signup_token' });

        const pendingRes = await query(
            `SELECT tenant_slug, admin_email, admin_owner_name, tenant_name
             FROM pending_signups
             WHERE signup_token = $1`,
            [signup_token]
        );
        if (pendingRes.rows.length > 0) {
            const slug = pendingRes.rows[0].tenant_slug || null;
            const signupConfig = getPayPalSignupConfig();
            await enqueueProvisioningJob(slug, signup_token, subscription_id, {
                manual_trigger: true,
                paypal_subscription_id: subscription_id || null,
                paypal_plan_id: signupConfig.planId
            });
            await sendSignupWelcomeEmailOnce(signup_token, signupConfig).catch((err) => {
                console.error('[PayPal Approve] Failed to send signup welcome email:', err.message);
            });
        }
        res.json({ success: true });
    } catch (e) {
        console.error('[PayPal Approve Error]', e);
        res.status(500).json({ error: 'Failed to queue provisioning' });
    }
});

// POST /api/v1/payments/paypal/create-subscription
// This endpoint is used by the frontend setup form to securely lodge the tenant config,
// generate a token, and return it. The frontend will pass this token to the PayPal JS SDK.
router.post('/paypal/create-subscription', async (req, res) => {
    try {
        const {
            tenant_name, admin_email, admin_password,
            admin_owner_name, theme_id, plan_id
        } = req.body;

        if (!tenant_name || !admin_email || !admin_password) {
            return res.status(400).json({ error: 'Missing required onboarding fields.' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(admin_email)) {
            return res.status(400).json({ error: 'Please enter a valid email address.' });
        }

        const bcrypt = require('bcryptjs');
        const hash = await bcrypt.hash(admin_password, 12);
        const signupConfig = getPayPalSignupConfig();
        const normalizedPlanId = normalizeInternalSignupPlanId(plan_id);
        const signup_token = crypto.randomUUID();

        await query(
            `INSERT INTO pending_signups (signup_token, tenant_slug, tenant_name, admin_email, admin_password_hash, admin_owner_name, theme_id, plan_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [signup_token, null, tenant_name, admin_email.toLowerCase(), hash, admin_owner_name || admin_email, theme_id || null, normalizedPlanId]
        );

        res.json({
            message: 'Pending signup created successfully. Pass this token as custom_id to PayPal checkout.',
            signup_token,
            paypal_client_id: signupConfig.clientId,
            paypal_plan_id: signupConfig.planId,
            trial_days: signupConfig.trialDays,
            monthly_price_usd: signupConfig.monthlyPriceUsd
        });
    } catch (e) {
        console.error('[Create Subscription Error]', e);
        if (e.code === '23505') { // Unique violation
            return res.status(400).json({ error: 'Tenant slug already exists.' });
        }
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// POST /api/v1/payments/wipay/webhook — Server-Side Callback
router.post('/wipay/webhook', async (req, res) => {
    try {
        const { order_id, transaction_id, status, hash, total } = req.body;
        
        if (!order_id || !transaction_id) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const isNew = await checkIdempotency('wipay', transaction_id, req.body);
        if (!isNew) {
            console.log(`[WiPay Webhook] Duplicate transaction ${transaction_id} ignored.`);
            return res.json({ received: true, duplicate: true });
        }

        // order_id corresponds to booking_payments.id, NOT bookings.id
        const paymentRes = await query(
            `SELECT p.*, b.tenant_id FROM booking_payments p 
             JOIN bookings b ON b.id = p.booking_id 
             WHERE p.id = $1 AND p.status = 'pending'`,
            [order_id]
        );

        if (paymentRes.rows.length === 0) {
             return res.status(404).json({ error: 'Pending payment not found' });
        }
        const payment = paymentRes.rows[0];

        // Fetch tenant to get keys
        const tRes = await query(`SELECT * FROM tenants WHERE id = $1`, [payment.tenant_id]);
        const tenant = tRes.rows[0];
        const config = tenant.payment_settings || {};
        
        // Ensure we decrypt the merchant code if needed
        const { decrypt } = require('../../services/encryption');
        let merchantId = config.wipay_merchant_code;
        if (merchantId && merchantId.includes(':')) {
            merchantId = decrypt(merchantId);
        }

        // Hash verification would go here (similar to what verify transaction does)
        // For now, if status is approved/success, we confirm it.
        const { verifyTransaction } = require('../../services/wipay');
        
        try {
             // Perform an actual server-to-server check to verify authenticity.
             // (Note: WiPay does not offer signed cryptographic headers like PayPal. 
             // We authenticate by actively fetching the transaction status from WiPay's secure API.)
             const verification = await verifyTransaction(transaction_id, payment.id, tenant);
             
             const isPaid = ['success', 'approved'].includes((verification.status || '').toLowerCase());

             if (isPaid) {
                 await query(
                    `UPDATE booking_payments SET status = 'paid', external_reference = $1, gateway_response = $2 WHERE id = $3`,
                    [transaction_id, JSON.stringify(verification), payment.id]
                 );
                 
                 // Mark booking as confirmed
                 const bRes = await query(
                    `UPDATE bookings SET status = 'confirmed', updated_at = NOW() WHERE id = $1 RETURNING *`,
                    [payment.booking_id]
                 );
                 
                 const { sendBookingConfirmation } = require('../../services/email');
                 sendBookingConfirmation(bRes.rows[0], tenant).catch(console.error);
             }
        } catch (verifyErr) {
             console.error('[WiPay Webhook] Authenticity check failed:', verifyErr.message);
             return res.status(403).json({ error: 'Webhook authenticity verification failed.' });
        }

        res.json({ received: true });
    } catch (e) {
        console.error('[WiPay Webhook Error]', e);
        res.status(500).json({ error: 'Webhook processing failed.' });
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
        const baseUrl      = process.env.PUBLIC_APP_URL || process.env.BASE_URL || `${req.headers['x-forwarded-proto'] || req.protocol}://${req.get('host')}`;
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
        const baseUrl      = process.env.PUBLIC_APP_URL || process.env.BASE_URL || `${req.headers['x-forwarded-proto'] || req.protocol}://${req.get('host')}`;

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
