/**
 * Invoice Worker — ICSS Booking System
 *
 * Processes the `invoice-dispatch` queue job.
 * Triggered exclusively by PAYMENT.SALE.COMPLETED events (real money received).
 *
 * Flow (hardened for safe retries):
 *   1. Validate eventId (skip if missing)
 *   2. Check idempotency_keys (skip if already dispatched)
 *   3. Resolve tenant + owner details from DB
 *   4. Build billing period and plan name from event context
 *   5. Generate invoice number (ICSS-YYYYMMDD-XXXX)
 *   6. INSERT subscription_invoices row in 'processing' state (idempotency guard)
 *      — ON CONFLICT DO NOTHING means retries are safe before email is sent
 *   7. Generate PDF buffer via generateSubscriptionInvoicePDF
 *   8. Send email via sendSubscriptionInvoiceEmail
 *   9. UPDATE subscription_invoices.status = 'sent', sent_at = NOW()
 *  10. Write idempotency_keys marker
 *
 * If PDF generation or email fails: throw so pg-boss retries the job.
 * Never mark dispatch complete unless BOTH steps succeed.
 */

const { query } = require('../db/connection');
const { generateSubscriptionInvoicePDF } = require('./pdf-generator');
const { sendSubscriptionInvoiceEmail }   = require('./email');

// ── Invoice Number Generator ────────────────────────────────────────────────────
function buildInvoiceNumber(eventId, paidAt) {
    const date = paidAt ? new Date(paidAt) : new Date();
    const yyyy = date.getUTCFullYear();
    const mm   = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd   = String(date.getUTCDate()).padStart(2, '0');
    // Use first 4 chars of eventId (uppercased) for human-readable uniqueness
    const suffix = String(eventId || '').replace(/[^A-Z0-9]/gi, '').slice(0, 4).toUpperCase() || 'XXXX';
    return `ICSS-${yyyy}${mm}${dd}-${suffix}`;
}

// ── Billing Period Helper ───────────────────────────────────────────────────────
// Derives a human-readable billing period (e.g. "Apr 2026 – May 2026")
// from the payment date. For monthly plans this covers next 30 days.
function buildBillingPeriod(paidAt) {
    const start = paidAt ? new Date(paidAt) : new Date();
    const end   = new Date(start);
    end.setDate(end.getDate() + 30);
    const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    return `${fmt(start)} – ${fmt(end)}`;
}

// ── Main Worker ─────────────────────────────────────────────────────────────────
async function processInvoiceDispatch(job) {
    const { tenantId, eventId, amount, subscriptionId, planName: jobPlanName, eventType } = job.data;

    // ── 1. Validate eventId
    if (!eventId) {
        console.warn('[InvoiceWorker] Job missing eventId — cannot ensure idempotency. Skipping.');
        return;
    }

    // ── 2. Check idempotency_keys (fast path — avoids DB work if already done)
    const idem = await query(
        `SELECT id FROM idempotency_keys WHERE provider = 'invoice_dispatch' AND event_id = $1`,
        [eventId]
    );
    if (idem.rows.length > 0) {
        console.log(`[InvoiceWorker] Invoice for event ${eventId} already dispatched. Skipping duplicate.`);
        return;
    }

    // ── 3. Resolve tenant + owner
    const tenantRes = await query(
        `SELECT t.id, t.name, t.slug
         FROM tenants t
         WHERE t.id = $1`,
        [tenantId]
    );
    if (tenantRes.rows.length === 0) {
        console.error(`[InvoiceWorker] Tenant ${tenantId} not found. Dropping job.`);
        return; // Don't retry — tenant doesn't exist
    }
    const tenant = tenantRes.rows[0];

    const ownerRes = await query(
        `SELECT email, name FROM users WHERE tenant_id = $1 AND role = 'tenant_admin' LIMIT 1`,
        [tenantId]
    );
    if (ownerRes.rows.length === 0) {
        console.error(`[InvoiceWorker] No tenant_admin found for tenant ${tenantId}. Dropping job.`);
        return; // Don't retry — owner config issue
    }
    const owner = ownerRes.rows[0];

    // ── 4. Resolve billing context
    const paidAt       = new Date(); // Use current time; PayPal event time can be added later if passed
    const planName     = jobPlanName || 'Monthly'; // Structured for future resolution from subscription metadata
    const billingPeriod = buildBillingPeriod(paidAt);
    const invoiceNumber = buildInvoiceNumber(eventId, paidAt);
    const currency      = 'USD';

    console.log(`[InvoiceWorker] Processing invoice ${invoiceNumber} for tenant ${tenantId} (${owner.email})`);

    // ── 5. Insert subscription_invoices row in 'processing' state
    // ON CONFLICT DO NOTHING: if retried before email sends, the row already exists,
    // so we update rather than duplicate. The UNIQUE constraint is the hard guard.
    let invoiceRowId = null;
    try {
        const insRes = await query(
            `INSERT INTO subscription_invoices
                (tenant_id, provider, provider_event_id, subscription_id, invoice_number,
                 amount, currency, plan_name, billing_period, status)
             VALUES ($1, 'paypal', $2, $3, $4, $5, $6, $7, $8, 'processing')
             ON CONFLICT (provider, provider_event_id) DO UPDATE
                SET status = EXCLUDED.status
             RETURNING id`,
            [tenantId, eventId, subscriptionId || null, invoiceNumber,
             amount, currency, planName, billingPeriod]
        );
        invoiceRowId = insRes.rows[0]?.id;
    } catch (dbErr) {
        // If the unique(invoice_number) constraint fires, the row is already processing/sent — skip
        if (dbErr.code === '23505') {
            console.log(`[InvoiceWorker] Duplicate invoice_number ${invoiceNumber} — skipping.`);
            return;
        }
        throw dbErr;
    }

    // ── 6 & 7. Generate PDF then send email
    let pdfBuffer;
    try {
        pdfBuffer = await generateSubscriptionInvoicePDF({
            tenant:         { name: tenant.name, slug: tenant.slug },
            owner:          { name: owner.name, email: owner.email },
            amount,
            currency,
            subscriptionId: subscriptionId || null,
            eventId,
            paidAt,
            planName,
            billingPeriod,
            invoiceNumber,
        });
        console.log(`[InvoiceWorker] PDF generated (${Math.round(pdfBuffer.length / 1024)}KB) for ${invoiceNumber}`);
    } catch (pdfErr) {
        console.error(`[InvoiceWorker] PDF generation failed for ${invoiceNumber}:`, pdfErr.message);
        throw pdfErr; // pg-boss will retry
    }

    try {
        await sendSubscriptionInvoiceEmail({
            to:           owner.email,
            ownerName:    owner.name,
            businessName: tenant.name,
            amount,
            currency,
            invoiceNumber,
            paidAt,
            pdfBuffer,
        });
    } catch (emailErr) {
        console.error(`[InvoiceWorker] Email send failed for ${invoiceNumber}:`, emailErr.message);
        throw emailErr; // pg-boss will retry
    }

    // ── 8. Mark invoice as sent in DB
    if (invoiceRowId) {
        await query(
            `UPDATE subscription_invoices SET status = 'sent', sent_at = NOW() WHERE id = $1`,
            [invoiceRowId]
        );
    }

    // ── 9. Write idempotency marker — only reached if both PDF + email succeeded
    await query(
        `INSERT INTO idempotency_keys (provider, event_id) VALUES ('invoice_dispatch', $1)
         ON CONFLICT DO NOTHING`,
        [eventId]
    );

    console.log(`[InvoiceWorker] ✓ Invoice ${invoiceNumber} dispatched to ${owner.email}`);
}

module.exports = { processInvoiceDispatch };
