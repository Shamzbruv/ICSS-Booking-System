const { query } = require('../db/connection');
const { createTransaction } = require('./ledger');

/**
 * Worker for processing the `paypal-webhooks` queue.
 * Converts raw PayPal webhook events into structured double-entry ledger transactions
 * and enqueues invoice dispatch — but ONLY on real payment events (PAYMENT.SALE.COMPLETED).
 *
 * Invoice generation is deliberately NOT triggered by BILLING.SUBSCRIPTION.ACTIVATED
 * because activation does not confirm money was received. Only PAYMENT.SALE.COMPLETED
 * confirms an actual charge.
 */
async function processPayPalWebhook(job) {
    const paypalEvent = job.data;

    try {
        // ── Subscription Status Sync only — do NOT generate an invoice ────────
        if (paypalEvent.event_type === 'BILLING.SUBSCRIPTION.ACTIVATED') {
            const subId = paypalEvent.resource?.id;
            if (subId) {
                const tRes = await query(`SELECT id FROM tenants WHERE paypal_subscription_id = $1`, [subId]);
                if (tRes.rows.length > 0) {
                    console.log(`[LedgerQueue] Subscription activated for tenant ${tRes.rows[0].id} — status sync only, no invoice.`);
                }
            }
            return; // Invoice is triggered exclusively by PAYMENT.SALE.COMPLETED
        }

        // ── Real Payment Received — generate ledger entry + invoice ───────────
        if (paypalEvent.event_type === 'PAYMENT.SALE.COMPLETED') {
            const subId    = paypalEvent.resource?.billing_agreement_id || paypalEvent.resource?.id;
            const customId = paypalEvent.resource?.custom_id; // signup_token fallback
            const amount   = parseFloat(paypalEvent.resource?.amount?.total || 0);

            // Derive plan name from resource metadata where possible; default Monthly
            const planName = paypalEvent.resource?.description?.includes('Annual') ? 'Annual' : 'Monthly';

            let tenantId = null;

            if (subId) {
                const tRes = await query(`SELECT id FROM tenants WHERE paypal_subscription_id = $1`, [subId]);
                if (tRes.rows.length > 0) tenantId = tRes.rows[0].id;
            }

            if (!tenantId && customId) {
                // Fallback: resolve via pending_signups signup_token
                const sRes = await query(`SELECT tenant_slug FROM pending_signups WHERE signup_token = $1`, [customId]);
                if (sRes.rows.length > 0 && sRes.rows[0].tenant_slug) {
                    const tRes = await query(`SELECT id FROM tenants WHERE slug = $1`, [sRes.rows[0].tenant_slug]);
                    if (tRes.rows.length > 0) tenantId = tRes.rows[0].id;
                }
            }

            if (tenantId && amount > 0) {
                console.log(`[LedgerQueue] Recording payment ${amount} for tenant ${tenantId} (event: ${paypalEvent.id})`);

                // 1. Record double-entry ledger transaction
                await createTransaction({
                    tenantId,
                    description:   `PayPal Subscription Payment: ${paypalEvent.event_type}`,
                    referenceType: 'paypal',
                    referenceId:    paypalEvent.id,
                    entries: [
                        { accountCode: '1000', type: 'debit',  amount }, // Debit PayPal Holding (Asset)
                        { accountCode: '4000', type: 'credit', amount }  // Credit SaaS Revenue
                    ]
                });

                // 2. Enqueue invoice dispatch with rich context
                const { enqueue } = require('./queue'); // Lazy require — avoids circular dependency
                await enqueue('invoice-dispatch', {
                    tenantId,
                    eventId:        paypalEvent.id,
                    amount,
                    subscriptionId: subId || null,
                    planName,
                    eventType:      paypalEvent.event_type,
                });
            } else {
                console.warn(`[LedgerQueue] PAYMENT.SALE.COMPLETED: Unmapped or zero-amount event ignored: ${paypalEvent.id}`);
            }
        }
    } catch (err) {
        console.error('[LedgerQueue] Error processing PayPal webhook:', err.message);
        throw err;
    }
}

module.exports = { processPayPalWebhook };
