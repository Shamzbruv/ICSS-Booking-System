const PDFDocument = require('pdfkit');
const path = require('path');
const { query } = require('../db/connection');
const { getGateway } = require('./paymentGateways');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clean = (v, max = 200) => String(v || '').replace(/[\x00-\x1f]/g, ' ').trim().slice(0, max);
const colour = (v, fallback) => /^#[0-9a-f]{6}$/i.test(v || '') ? v : fallback;

function invoiceSettings(tenant, input = tenant.invoice_settings || {}) {
    const site = tenant.site_config || {}, old = tenant.branding || {};
    return {
        primaryColor: colour(input.primaryColor, colour(site.style?.colors?.primary || old.primaryColor, '#392070')),
        accentColor: colour(input.accentColor, colour(site.style?.colors?.accent || old.accentColor, '#D4AF37')),
        businessName: clean(input.businessName || site.brand?.name || tenant.name, 100),
        address: clean(input.address ?? site.contact?.address ?? old.location ?? old.address, 220),
        email: clean(input.email ?? site.contact?.email ?? old.replyEmail, 120),
        phone: clean(input.phone ?? site.contact?.phone ?? old.phone, 50),
        registration: clean(input.registration, 100),
        logoUrl: clean(input.logoUrl ?? site.brand?.logoUrl ?? old.logoUrl, 1500000),
        paymentInstructions: clean(input.paymentInstructions ?? tenant.bank_transfer_instructions, 500),
        footer: clean(input.footer ?? 'Thank you for choosing us. Please contact us with any questions about this invoice.', 300)
    };
}

function validLogoData(value) {
    if (!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(value || '') || value.length > 1500000) return false;
    try {
        const bytes = Buffer.from(value.split(',')[1], 'base64');
        if (bytes.length > 1048576) return false;
        const probe = new PDFDocument({ autoFirstPage: false });
        const image = probe.openImage(bytes);
        probe.end(); probe.resume();
        return image.width > 0 && image.height > 0 && image.width <= 4096 && image.height <= 4096;
    } catch { return false; }
}

function validateSettings(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invoice settings must be an object.');
    const limits = { businessName: 100, address: 220, email: 120, phone: 50, registration: 100, paymentInstructions: 500, footer: 300, logoUrl: 1500000 };
    for (const [key, max] of Object.entries(limits)) {
        if (input[key] != null && (typeof input[key] !== 'string' || input[key].length > max)) throw new Error(`${key} is too long or invalid.`);
    }
    for (const key of ['primaryColor', 'accentColor']) if (input[key] != null && !/^#[0-9a-f]{6}$/i.test(input[key])) throw new Error('Choose valid invoice colours.');
    if (input.logoUrl && !/^\/media\/[0-9a-f-]{36}$/i.test(input.logoUrl) && !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(input.logoUrl)) throw new Error('Upload a PNG or JPG logo for your invoice.');
    if (input.logoUrl?.startsWith('data:') && !validLogoData(input.logoUrl)) throw new Error('The logo could not be read. Use a PNG or JPG up to 1 MB and 4096 pixels per side.');
    return invoiceSettings({}, input);
}

async function logoData(tenantId, url, runQuery = query) {
    if (validLogoData(url)) return url;
    const id = /^\/media\/([0-9a-f-]{36})$/i.exec(url || '')?.[1];
    if (!id || !UUID.test(id)) return '';
    const result = await runQuery(`SELECT data,mime FROM tenant_media WHERE id=$1 AND tenant_id=$2 AND mime IN ('image/png','image/jpeg') AND size_bytes <= 1048576`, [id, tenantId]);
    const media = result.rows[0];
    const data = media ? `data:${media.mime};base64,${media.data.toString('base64')}` : '';
    return validLogoData(data) ? data : '';
}

function snapshotFor(booking, tenant, service = {}) {
    return {
        brand: invoiceSettings(tenant),
        customer: { name: clean(booking.name, 120), email: clean(booking.email, 254), phone: clean(booking.phone, 50) },
        service: clean(service.name || booking.service_name || 'Booked service', 160),
        servicePrice: Number(booking.service_price ?? service.price ?? 0),
        afterHoursFee: Number(booking.after_hours_fee || 0),
        currency: clean(booking.service_currency || service.currency || 'JMD', 3),
        date: booking.booking_date instanceof Date ? booking.booking_date.toISOString().slice(0, 10) : String(booking.booking_date).slice(0, 10),
        time: String(booking.booking_time || '').slice(0, 5),
        timezone: tenant.branding?.timezone || 'America/Jamaica',
        paymentMode: booking.payment_mode || 'none',
        bookingSource: booking.booking_source || 'online'
    };
}

async function ensureBookingInvoice(booking, tenant, service, runQuery = query) {
    const existing = await runQuery(`SELECT * FROM booking_invoices WHERE booking_id=$1 AND tenant_id=$2`, [booking.id, tenant.id]);
    if (existing.rows.length) return existing.rows[0];
    if (!service) {
        const result = await runQuery(`SELECT name,price,currency FROM services WHERE id=$1 AND tenant_id=$2`, [booking.service_id, tenant.id]);
        service = result.rows[0] || {};
    }
    const snapshot = snapshotFor(booking, tenant, service);
    snapshot.brand.logoData = await logoData(tenant.id, snapshot.brand.logoUrl, runQuery);
    delete snapshot.brand.logoUrl;
    const inserted = await runQuery(`INSERT INTO booking_invoices (tenant_id,booking_id,snapshot) VALUES ($1,$2,$3)
        ON CONFLICT (booking_id) DO UPDATE SET booking_id=EXCLUDED.booking_id RETURNING *`, [tenant.id, booking.id, JSON.stringify(snapshot)]);
    return inserted.rows[0];
}

function invoiceNumber(invoice) {
    return `INV-${new Date(invoice.created_at).getUTCFullYear()}-${String(invoice.id).padStart(6, '0')}`;
}
function invoiceTotals(snapshot, payments) {
    const total = Math.round((snapshot.servicePrice + snapshot.afterHoursFee) * 100) / 100;
    const paid = Math.round(payments.filter(p => p.status === 'paid' && p.currency === snapshot.currency).reduce((sum, p) => sum + Number(p.amount_due || 0), 0) * 100) / 100;
    return { total, paid, balance: Math.max(0, total - paid), credit: Math.max(0, paid - total) };
}
function renderBookingInvoice(invoice, booking, payments = []) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 44, info: { Title: `${invoiceNumber(invoice)} - ${invoice.snapshot.brand.businessName}`, Author: invoice.snapshot.brand.businessName } });
        doc.registerFont('Invoice', path.join(__dirname, '../assets/fonts/DejaVuSans-Invoice.ttf'));
        doc.registerFont('InvoiceBold', path.join(__dirname, '../assets/fonts/DejaVuSans-Invoice-Bold.ttf'));
        doc.page.margins.bottom = 20;
        const buffers = []; doc.on('data', b => buffers.push(b)); doc.on('end', () => resolve(Buffer.concat(buffers))); doc.on('error', reject);
        try {
            const s = invoice.snapshot, brand = s.brand, { total, paid, balance, credit } = invoiceTotals(s, payments);
            const money = n => `${s.currency} ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            const text = (v, x, y, width, size = 10, bold = false, color = '#263044', height) => doc.font(bold ? 'InvoiceBold' : 'Invoice').fontSize(size).fillColor(color).text(String(v || ''), x, y, { width, ...(height ? { height, ellipsis: true } : {}) });
            doc.rect(0, 0, 596, 10).fill(brand.primaryColor);
            doc.rect(44, 35, 5, 70).fill(brand.accentColor);
            let left = 60;
            if (brand.logoData) {
                try { doc.image(Buffer.from(brand.logoData.split(',')[1], 'base64'), 60, 38, { fit: [65, 65], align: 'center', valign: 'center' }); left = 140; } catch { /* A damaged logo never prevents the invoice from being delivered. */ }
            }
            text(brand.businessName, left, 38, 350-left, brand.businessName.length > 60 ? 12 : 18, true, '#182033', 65);
            text('INVOICE', 365, 38, 185, 24, true, brand.primaryColor);
            text(invoiceNumber(invoice), 365, 72, 185, 10, true);
            text(`Issued ${new Date(invoice.created_at).toISOString().slice(0, 10)}`, 365, 91, 185, 9);
            text([brand.address, [brand.email, brand.phone].filter(Boolean).join(' | '), brand.registration].filter(Boolean).join('\n'), 60, 119, 490, 9, false, '#5A6474', 60);
            doc.moveTo(44, 192).lineTo(551, 192).strokeColor('#DDE2EA').stroke();
            text('BILL TO', 44, 213, 235, 9, true, '#687184');
            text(s.customer.name, 44, 234, 235, s.customer.name.length > 50 ? 10 : 13, true, '#182033', 36);
            text([s.customer.email, s.customer.phone].filter(Boolean).join('\n'), 44, 274, 235, s.customer.email.length > 100 ? 7.5 : 9, false, '#5A6474', 48);
            text('BOOKING DETAILS', 320, 213, 230, 9, true, '#687184');
            text(`${s.date} at ${s.time}\n${s.timezone}\nStatus: ${String(booking.status).replaceAll('_', ' ')}\nBooked ${s.bookingSource === 'phone' ? 'by phone' : 'online'}`, 320, 234, 230, 10, false, '#263044', 80);
            doc.roundedRect(44, 334, 507, 32, 5).fill('#F0F2F7');
            text('DESCRIPTION', 56, 345, 320, 9, true);
            text('AMOUNT', 400, 345, 140, 9, true);
            text(s.service, 56, 382, 320, 11, true, '#263044', 42);
            text(money(s.servicePrice), 400, 382, 140, 10);
            if (s.afterHoursFee) { text('After-hours service fee', 56, 432, 320, 10); text(money(s.afterHoursFee), 400, 432, 140, 10); }
            doc.moveTo(44, 465).lineTo(551, 465).strokeColor('#DDE2EA').stroke();
            text('Payment method', 44, 486, 220, 9, true, '#687184');
            const method = s.paymentMode === 'in_person' ? 'Offline / in person' : s.paymentMode === 'none' ? 'No advance payment required' : (getGateway(s.paymentMode)?.label || s.paymentMode);
            text(method, 44, 505, 230, 11, false, '#263044', 36);
            text('Service total', 320, 486, 100, 10); text(money(total), 425, 486, 126, 10, true);
            text('Verified paid', 320, 512, 100, 10); text(money(paid), 425, 512, 126, 10);
            const voided = ['cancelled', 'rejected', 'expired'].includes(booking.status);
            text(voided ? 'Booking closed' : 'Balance due', 320, 542, 105, 11, true, brand.primaryColor);
            text(voided ? 'Contact business' : money(balance), 425, 542, 126, 11, true, brand.primaryColor);
            if (credit) text(`Overpayment: ${money(credit)}. Contact the business.`, 320, 568, 230, 9);
            text(voided ? 'This booking is closed. Contact the business about any payment or refund.' : 'Only payments verified by the business appear as paid. An invoice is not proof of payment.', 44, 590, 507, 9, false, '#687184', 28);
            text('PAYMENT INFORMATION', 44, 636, 507, 9, true, '#687184');
            text(brand.paymentInstructions || 'Please arrange any outstanding payment directly with the business.', 44, 656, 507, 9, false, '#263044', 65);
            doc.moveTo(44, 735).lineTo(551, 735).strokeColor(brand.accentColor).stroke();
            text(brand.footer, 44, 752, 507, 9, false, '#5A6474', 42);
            text('Generated by ICSS Bookings', 44, 804, 507, 8, false, '#8A91A0');
            doc.end();
        } catch (err) { doc.end(); reject(err); }
    });
}

async function bookingInvoiceAttachment(booking, tenant) {
    const invoice = await ensureBookingInvoice(booking, tenant);
    const payments = await query(`SELECT status,amount_due,currency FROM booking_payments WHERE booking_id=$1 AND tenant_id=$2`, [booking.id, tenant.id]);
    const content = await renderBookingInvoice(invoice, booking, payments.rows);
    return { filename: `${invoiceNumber(invoice)}.pdf`, content };
}
module.exports = { invoiceSettings, validateSettings, snapshotFor, ensureBookingInvoice, renderBookingInvoice, bookingInvoiceAttachment, invoiceTotals, invoiceNumber, logoData };
