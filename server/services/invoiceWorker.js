const { query } = require('../db/connection');

/**
 * Worker for processing the `invoice-dispatch` queue.
 * Generates PDF invoices and dispatches them via Resend with a secure cloud link.
 */
async function processInvoiceDispatch(job) {
    const { tenantId, eventId, amount } = job.data;
    
    try {
        console.log(`[InvoiceWorker] Generating PDF invoice for tenant ${tenantId}, amount ${amount}`);
        
        // In a real implementation, we would use PDFKit here, write to a stream,
        // and upload it to an S3 bucket (e.g., using @aws-sdk/client-s3).
        // Mocking the generated S3 link:
        const secureInvoiceUrl = `https://secure-storage.icss.app/invoices/${tenantId}/${eventId}.pdf`;
        
        const uRes = await query(`
            SELECT email FROM users WHERE tenant_id = $1 AND role = 'tenant_admin' LIMIT 1
        `, [tenantId]);

        if (uRes.rows.length > 0) {
            const adminEmail = uRes.rows[0].email;
            console.log(`[InvoiceWorker] Dispatching invoice link to ${adminEmail} via Resend. Link: ${secureInvoiceUrl}`);
            
            // Dispatch via Resend API (Mocked for now, as it depends on existing Resend setup)
            // await resend.emails.send({ ... })
        } else {
            console.warn(`[InvoiceWorker] No tenant_admin found for tenant ${tenantId}`);
        }
    } catch (err) {
        console.error('[InvoiceWorker] Error processing invoice dispatch:', err.message);
        throw err; // pg-boss will automatically retry failed jobs based on configuration
    }
}

module.exports = { processInvoiceDispatch };
