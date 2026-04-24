/**
 * Test script: verifies generateSubscriptionInvoicePDF produces a valid PDF.
 * Writes the output to /tmp/test-icss-invoice.pdf for visual inspection.
 *
 * Usage:
 *   node server/scripts/test-invoice.js
 */
require('dotenv').config();
const path = require('path');
const fs   = require('fs');
const { generateSubscriptionInvoicePDF } = require('../services/pdf-generator');

(async () => {
    console.log('Generating test subscription invoice PDF...');

    const buf = await generateSubscriptionInvoicePDF({
        tenant: { name: 'Luxe Hair Studio', slug: 'luxe-hair' },
        owner:  { name: 'Jordan Clarke', email: 'jordan@luxehair.com' },
        amount:         35.50,
        currency:       'USD',
        subscriptionId: 'I-TESTSUBID1234',
        eventId:        'WH-ABCD1234EFGH5678',
        paidAt:         new Date(),
        planName:       'Monthly',
        billingPeriod:  'Apr 2026 – May 2026',
        invoiceNumber:  'ICSS-20260423-WH-A',
    });

    const outPath = '/tmp/test-icss-invoice.pdf';
    fs.writeFileSync(outPath, buf);

    const kb = Math.round(buf.length / 1024);
    if (buf.length < 10_000) {
        console.error(`FAIL: PDF is suspiciously small (${kb}KB). Check generator output.`);
        process.exit(1);
    }

    console.log(`✓ PDF generated successfully: ${outPath} (${kb}KB)`);
    process.exit(0);
})().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
