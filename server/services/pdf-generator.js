/**
 * PDF Generator Service — ICSS Booking System
 *
 * Adapted from ICSS Command Center pdfService.js.
 * Uses PDFKit (no Puppeteer/headless browser required) — much lighter weight.
 *
 * Generates two types of PDFs:
 *   - generateBookingConfirmationPDF(booking, tenant) → Buffer
 *   - generateOrderInvoicePDF(order, items, tenant)   → Buffer
 *
 * Both PDFs are branded per-tenant:
 *   logo, primary color, business name, address, contact
 */

const PDFDocument = require('pdfkit');
const path        = require('path');
const fs          = require('fs');

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(dateStr) {
    if (!dateStr) return '';
    const match = dateStr.toString().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
        const [, y, m, d] = match;
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
    }
    return String(dateStr);
}

function formatTime(timeStr) {
    if (!timeStr) return '';
    const t = String(timeStr).slice(0, 5);
    const [h, m] = t.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12  = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function getBrand(tenant) {
    const b = tenant?.branding || {};
    return {
        name:         b.businessName   || tenant?.name || 'ICSS Booking',
        primaryColor: b.primaryColor   || '#002B49',
        accentColor:  b.accentColor    || '#D4AF37',
        address:      b.address        || 'Jamaica',
        phone:        b.phone          || '',
        email:        b.replyEmail     || '',
        website:      b.bookingUrl     || 'https://icss.app',
        logoPath:     b.localLogoPath  || null
    };
}

// ── Shared PDF Layout Helpers ──────────────────────────────────────────────────
function drawHeader(doc, brand, title, subtitle) {
    const w = doc.page.width;

    // Top-right swoosh curves (same style as ICSS Command Center)
    doc.save();
    doc.moveTo(w * 0.55, 0)
        .quadraticCurveTo(w * 0.8, 70, w, 55)
        .lineTo(w, 0)
        .lineTo(w * 0.55, 0)
        .fillColor(brand.accentColor)
        .fill();
    doc.restore();

    doc.save();
    doc.moveTo(w * 0.65, 0)
        .quadraticCurveTo(w * 0.87, 52, w, 35)
        .lineTo(w, 0)
        .lineTo(w * 0.65, 0)
        .fillColor(brand.primaryColor)
        .fill();
    doc.restore();

    // Logo (if exists locally)
    let logoY = 30;
    if (brand.logoPath && fs.existsSync(brand.logoPath)) {
        doc.image(brand.logoPath, 40, 25, { width: 55 });
        logoY = 90;
    }

    // Business name
    doc.fillColor(brand.primaryColor)
        .fontSize(15)
        .font('Helvetica-Bold')
        .text(brand.name, 40, logoY);

    // Contact info
    let infoY = logoY + 18;
    doc.fontSize(8).font('Helvetica').fillColor('#555555');
    if (brand.address) { doc.text(brand.address, 40, infoY); infoY += 11; }
    if (brand.phone)   { doc.text(brand.phone,   40, infoY); infoY += 11; }
    if (brand.email)   { doc.text(brand.email,   40, infoY); infoY += 11; }
    if (brand.website) { doc.text(brand.website, 40, infoY); }

    // Document title (top right)
    doc.fillColor(brand.primaryColor)
        .fontSize(22)
        .font('Helvetica-Bold')
        .text(title, 0, 100, { align: 'right', width: w - 40 });

    if (subtitle) {
        doc.fontSize(9).font('Helvetica').fillColor('#777')
            .text(subtitle, 0, 126, { align: 'right', width: w - 40 });
    }
}

function drawFooter(doc, brand) {
    const w = doc.page.width;
    const h = doc.page.height;

    // Bottom swoosh
    doc.save();
    doc.moveTo(w / 2, h)
        .quadraticCurveTo(w * 0.75, h - 28, w, h - 45)
        .lineTo(w, h)
        .lineTo(w / 2, h)
        .fillColor(brand.primaryColor)
        .fill();
    doc.restore();

    // Footer text
    doc.fillColor('#999')
        .fontSize(8)
        .font('Helvetica')
        .text(`${brand.name} · ${brand.website}`, 40, h - 50, {
            width: w - 80,
            align: 'center'
        });
}

function drawDivider(doc, y, color = '#E0E0E0') {
    const w = doc.page.width;
    doc.moveTo(40, y).lineTo(w - 40, y).lineWidth(0.5).strokeColor(color).stroke();
}

// ── 1. Booking Confirmation PDF ───────────────────────────────────────────────
/**
 * Generates a booking confirmation PDF.
 * @param {Object} booking - Row from bookings table
 * @param {Object} tenant  - Tenant record (includes branding)
 * @returns {Promise<Buffer>} PDF as a Buffer
 */
function generateBookingPDF(booking, tenant) {
    return new Promise((resolve, reject) => {
        try {
            const doc    = new PDFDocument({ margin: 0, size: 'A4' });
            const chunks = [];
            doc.on('data', c => chunks.push(c));
            doc.on('end',  () => resolve(Buffer.concat(chunks)));

            const brand = getBrand(tenant);
            const w     = doc.page.width;

            drawHeader(doc, brand, 'BOOKING CONFIRMATION',
                `Ref: #${String(booking.id).slice(0, 8).toUpperCase()}`);

            // ── Divider ─────────────────────────────────────────────────────
            doc.rect(40, 175, w - 80, 2).fillColor(brand.accentColor).fill();

            // ── Guest Details ───────────────────────────────────────────────
            let y = 195;
            doc.fillColor(brand.primaryColor)
                .fontSize(11).font('Helvetica-Bold')
                .text('GUEST DETAILS', 40, y);

            y += 18;
            doc.fontSize(10).font('Helvetica').fillColor('#000');
            [[`Name`,  booking.name],
             [`Email`, booking.email],
             [`Phone`, booking.phone || '—']]
                .forEach(([label, val]) => {
                    doc.font('Helvetica-Bold').fillColor('#555').text(label + ':', 40, y, { continued: true, width: 100 });
                    doc.font('Helvetica').fillColor('#000').text('  ' + (val || '—'));
                    y += 18;
                });

            // ── Appointment Box ─────────────────────────────────────────────
            y += 10;
            doc.rect(40, y, w - 80, 95)
                .fillColor('#f9f9f9')
                .fill();
            doc.rect(40, y, 4, 95)
                .fillColor(brand.accentColor)
                .fill();

            doc.fillColor(brand.primaryColor)
                .fontSize(9).font('Helvetica-Bold')
                .text('APPOINTMENT DETAILS', 55, y + 14, { characterSpacing: 1 });

            y += 32;
            [[`Date`,   formatDate(booking.booking_date)],
             [`Time`,   formatTime(booking.booking_time)],
             [`Type`,   `In-Person Fitting${booking.region ? ' · ' + booking.region : ''}`]]
                .forEach(([label, val]) => {
                    doc.font('Helvetica-Bold').fillColor('#555').fontSize(10)
                        .text(label + ':', 55, y, { continued: true, width: 90 });
                    doc.font('Helvetica').fillColor('#000')
                        .text('  ' + (val || '—'));
                    y += 18;
                });

            // ── Notes ───────────────────────────────────────────────────────
            if (booking.notes) {
                y += 16;
                doc.fillColor(brand.primaryColor)
                    .fontSize(10).font('Helvetica-Bold')
                    .text('NOTES', 40, y);
                y += 14;
                doc.fontSize(9).font('Helvetica').fillColor('#444')
                    .text(booking.notes, 40, y, { width: w - 80, lineGap: 3 });
            }

            // ── Cancellation policy ─────────────────────────────────────────
            y = doc.page.height - 180;
            drawDivider(doc, y);
            y += 12;
            doc.fontSize(8).font('Helvetica').fillColor('#888')
                .text('To reschedule or cancel, please reply to your confirmation email or contact us directly.', 40, y, { width: w - 80, align: 'center' });

            drawFooter(doc, brand);
            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

// ── 2. Order Invoice PDF ──────────────────────────────────────────────────────
/**
 * Generates an order invoice PDF, adapted from ICSS Command Center pdfService.
 * @param {Object} order  - Row from orders table
 * @param {Array}  items  - Rows from order_items table
 * @param {Object} tenant - Tenant record
 * @returns {Promise<Buffer>}
 */
function generateOrderInvoicePDF(order, items, tenant) {
    return new Promise((resolve, reject) => {
        try {
            const doc    = new PDFDocument({ margin: 0, size: 'A4' });
            const chunks = [];
            doc.on('data', c => chunks.push(c));
            doc.on('end',  () => resolve(Buffer.concat(chunks)));

            const brand   = getBrand(tenant);
            const w       = doc.page.width;
            const printDate = formatDate(new Date().toISOString().slice(0, 10));

            drawHeader(doc, brand, 'INVOICE',
                `Invoice #${String(order.id).slice(0, 8).toUpperCase()} · ${printDate}`);

            // Divider
            doc.rect(40, 175, w - 80, 2).fillColor(brand.accentColor).fill();

            // ── Bill To ─────────────────────────────────────────────────────
            let y = 195;
            doc.fillColor(brand.primaryColor)
                .fontSize(11).font('Helvetica-Bold')
                .text('BILL TO', 40, y);

            y += 16;
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#000').text(order.customer_name || 'Valued Customer', 40, y);
            y += 14;
            doc.font('Helvetica').fillColor('#555').fontSize(9);
            if (order.customer_email) { doc.text(order.customer_email, 40, y); y += 12; }
            if (order.shipping_address) {
                doc.text(`${order.shipping_address}, ${order.city || ''} ${order.country || ''}`, 40, y);
                y += 12;
            }

            // ── Items Table ─────────────────────────────────────────────────
            y += 20;
            const tableTop = y;

            // Header row
            doc.rect(40, tableTop, w - 80, 24).fillColor(brand.primaryColor).fill();
            doc.fillColor('#fff').fontSize(8).font('Helvetica-Bold')
                .text('DESCRIPTION', 50, tableTop + 8)
                .text('AMOUNT', w - 120, tableTop + 8, { width: 80, align: 'right' });

            y = tableTop + 32;
            doc.fillColor('#000').font('Helvetica').fontSize(9);

            (items || []).forEach((item, i) => {
                const bg = i % 2 === 0 ? '#fafafa' : '#fff';
                doc.rect(40, y - 4, w - 80, 22).fillColor(bg).fill();

                doc.fillColor('#000').font('Helvetica-Bold')
                    .text(item.suit_name || 'Service', 50, y);

                // Parse measurements for specs
                let specsStr = '';
                try {
                    const m = typeof item.measurements === 'object'
                        ? item.measurements
                        : JSON.parse(item.measurements || '{}');
                    if (m.gender) specsStr += `Gender: ${m.gender}  `;
                    if (m.suggestedSize) specsStr += `Size: ${m.suggestedSize}`;
                } catch { /* ignore */ }

                if (specsStr) {
                    doc.font('Helvetica').fillColor('#777').fontSize(7.5).text(specsStr, 50, y + 11);
                }

                const price = item.price ? `${order.currency === 'GBP' ? '£' : order.currency === 'JMD' ? 'J$' : '$'}${Number(item.price).toLocaleString()}` : 'Included';
                doc.font('Helvetica').fillColor('#000').fontSize(9)
                    .text(price, w - 120, y, { width: 80, align: 'right' });

                drawDivider(doc, y + 20);
                y += 28;
            });

            // ── Total Box ───────────────────────────────────────────────────
            y += 10;
            const currSymbol = order.currency === 'GBP' ? '£' : order.currency === 'JMD' ? 'J$' : '$';
            const totalStr   = `${currSymbol}${Number(order.total_amount || 0).toLocaleString()} ${order.currency || ''}`;

            doc.rect(w - 240, y, 200, 32).fillColor(brand.primaryColor).fill();
            doc.fillColor('#fff').fontSize(11).font('Helvetica-Bold')
                .text('TOTAL DUE', w - 230, y + 10, { continued: true })
                .fillColor(brand.accentColor)
                .text('  ' + totalStr, { align: 'right', width: 160 });

            // ── Status watermark ────────────────────────────────────────────
            const status     = (order.status || 'draft').toUpperCase();
            const waterColor = order.status === 'paid' ? 'rgba(34,197,94,0.10)' : 'rgba(200,200,200,0.10)';
            doc.save()
                .rotate(-45, { origin: [w / 2, doc.page.height / 2] })
                .fontSize(72).font('Helvetica-Bold')
                .fillColor(order.status === 'paid' ? '#22c55e' : '#aaaaaa')
                .opacity(0.08)
                .text(status, 0, doc.page.height / 2 - 36, { width: w, align: 'center' })
                .restore();

            // ── Payment reference ───────────────────────────────────────────
            if (order.payment_ref) {
                y += 50;
                doc.fillColor('#555').fontSize(8).font('Helvetica')
                    .text(`Payment Reference: ${order.payment_ref}`, 40, y);
            }

            drawFooter(doc, brand);
            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

/**
 * Save a PDF buffer to a temp file and return the path.
 * Useful for attaching to emails.
 */
async function savePDFToTemp(buffer, filename) {
    const tmpDir  = path.join(__dirname, '../../data/pdfs');
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const filePath = path.join(tmpDir, filename);
    fs.writeFileSync(filePath, buffer);
    return filePath;
}

module.exports = { generateBookingPDF, generateOrderInvoicePDF, savePDFToTemp };
