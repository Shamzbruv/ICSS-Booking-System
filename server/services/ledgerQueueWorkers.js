const { query } = require('../db/connection');
const { createTransaction } = require('./ledger');

/**
 * Worker for processing the `paypal-webhooks` queue.
 * Converts raw PayPal webhook events into structured double-entry ledger transactions.
 */
async function processPayPalWebhook(job) {
    const paypalEvent = job.data;

    try {
        if (paypalEvent.event_type === 'BILLING.SUBSCRIPTION.ACTIVATED' || paypalEvent.event_type === 'PAYMENT.SALE.COMPLETED') {
            
            // Locate the tenant associated with this subscription
            const subId = paypalEvent.resource?.billing_agreement_id || paypalEvent.resource?.id;
            const customId = paypalEvent.resource?.custom_id; // Sometimes passed as signup_token
            
            let tenantId = null;
            let amount = parseFloat(paypalEvent.resource?.amount?.total || 0);

            if (subId) {
                const tRes = await query(`SELECT id FROM tenants WHERE paypal_subscription_id = $1`, [subId]);
                if (tRes.rows.length > 0) tenantId = tRes.rows[0].id;
            }

            if (!tenantId && customId) {
                // Fallback: check if we can resolve via pending_signups token mapping
                const sRes = await query(`SELECT tenant_slug FROM pending_signups WHERE signup_token = $1`, [customId]);
                if (sRes.rows.length > 0 && sRes.rows[0].tenant_slug) {
                    const tRes = await query(`SELECT id FROM tenants WHERE slug = $1`, [sRes.rows[0].tenant_slug]);
                    if (tRes.rows.length > 0) tenantId = tRes.rows[0].id;
                }
            }

            if (tenantId && amount > 0) {
                console.log(`[LedgerQueue] Recording ${amount} for tenant ${tenantId} from event ${paypalEvent.id}`);
                
                // 1. Record Double-Entry Transaction
                await createTransaction({
                    tenantId,
                    description: `PayPal Subscription Event: ${paypalEvent.event_type}`,
                    referenceType: 'paypal',
                    referenceId: paypalEvent.id,
                    entries: [
                        { accountCode: '1000', type: 'debit', amount: amount }, // Debit PayPal Holding (Asset increases)
                        { accountCode: '4000', type: 'credit', amount: amount } // Credit SaaS Revenue (Revenue increases)
                    ]
                });

                // 2. Enqueue the invoice generation
                const { enqueue } = require('./queue'); // Lazy require to avoid circular dependency
                await enqueue('invoice-dispatch', { 
                    tenantId, 
                    eventId: paypalEvent.id, 
                    amount 
                });
            } else {
                console.warn(`[LedgerQueue] Unmapped or zero-amount event ignored: ${paypalEvent.id}`);
            }
        }
    } catch (err) {
        console.error('[LedgerQueue] Error processing PayPal webhook:', err.message);
        throw err;
    }
}

module.exports = { processPayPalWebhook };
