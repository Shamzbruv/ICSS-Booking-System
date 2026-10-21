const express = require('express');
const { query } = require('../../db/connection');
const { authenticate, requireTenantOwnership } = require('../../middleware/auth');
const { invalidateTenantCache } = require('../../middleware/tenantResolver');
const { invoiceSettings, validateSettings, snapshotFor, renderBookingInvoice, bookingInvoiceAttachment, logoData } = require('../../services/bookingInvoices');
const router = express.Router();
router.use(authenticate, requireTenantOwnership('staff', 'tenant_admin'));
router.get('/settings', (req, res) => res.json({ settings: invoiceSettings(req.tenant) }));
router.put('/settings', requireTenantOwnership('tenant_admin'), async (req, res) => {
    let settings;
    try { settings = validateSettings(req.body); }
    catch (err) { return res.status(400).json({ error: err.message }); }
    try {
        // Validate ownership and freeze the actual logo bytes; deleting media later won't break invoices.
        settings.logoUrl = await logoData(req.tenant.id, settings.logoUrl);
        await query(`UPDATE tenants SET invoice_settings=$1,updated_at=NOW() WHERE id=$2`, [JSON.stringify(settings), req.tenant.id]);
        invalidateTenantCache(req.tenant.slug);
        res.json({ settings, success: true });
    } catch (err) { console.error('[Invoices/Settings]', err.message); res.status(500).json({ error: 'Invoice settings could not be saved.' }); }
});
router.post('/preview', requireTenantOwnership('tenant_admin'), async (req, res) => {
    try {
        const settings = validateSettings(req.body);
        const booking = { name: 'Sample Customer', email: 'customer@example.com', phone: '+1 876 555 0100', booking_date: new Date(), booking_time: '10:00', service_price: 10000, service_currency: 'JMD', payment_mode: 'manual', status: 'confirmed', booking_source: 'phone' };
        const snapshot = snapshotFor(booking, { ...req.tenant, invoice_settings: settings }, { name: 'Sample service' });
        snapshot.brand.logoData = await logoData(req.tenant.id, settings.logoUrl);
        const pdf = await renderBookingInvoice({ id: 'PREVIEW', created_at: new Date(), snapshot }, booking, [{ status: 'paid', amount_due: 2500, currency: 'JMD' }]);
        res.set({ 'Content-Type': 'application/pdf', 'Cache-Control': 'no-store', 'Content-Disposition': 'inline; filename="invoice-preview.pdf"' }).send(pdf);
    } catch (err) { res.status(400).json({ error: err.message || 'Preview could not be created.' }); }
});
router.get('/', async (req, res) => {
    const page = Math.max(1, Math.min(10000, parseInt(req.query.page, 10) || 1));
    try {
        const result = await query(`SELECT b.id AS booking_id,b.name,b.email,b.booking_date,b.status,i.id AS invoice_id,i.created_at AS issued_at
            FROM bookings b LEFT JOIN booking_invoices i ON i.booking_id=b.id AND i.tenant_id=b.tenant_id
            WHERE b.tenant_id=$1 ORDER BY b.created_at DESC,b.id DESC LIMIT 26 OFFSET $2`, [req.tenant.id, (page - 1) * 25]);
        res.json({ invoices: result.rows.slice(0, 25), hasMore: result.rows.length > 25, page });
    } catch (err) { res.status(500).json({ error: 'Invoices could not be loaded.' }); }
});
router.get('/:bookingId/pdf', async (req, res) => {
    if (!/^[0-9a-f-]{36}$/i.test(req.params.bookingId)) return res.status(400).json({ error: 'Invalid booking.' });
    try {
        const result = await query(`SELECT * FROM bookings WHERE id=$1 AND tenant_id=$2`, [req.params.bookingId, req.tenant.id]);
        if (!result.rows.length) return res.status(404).json({ error: 'Booking not found.' });
        const pdf = await bookingInvoiceAttachment(result.rows[0], req.tenant);
        res.set({ 'Content-Type': 'application/pdf', 'Cache-Control': 'no-store', 'Content-Disposition': `attachment; filename="${pdf.filename}"` }).send(pdf.content);
    } catch (err) { console.error('[Invoices/PDF]', err.message); res.status(500).json({ error: 'Invoice could not be created. Please try again.' }); }
});
module.exports = router;
