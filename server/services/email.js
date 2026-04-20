/**
 * Email Service — Multi-Tenant, Tenant-Branded
 * Uses Resend for delivery. Branding injected from req.tenant.branding.
 * PDF attachments generated via pdf-generator.js (PDFKit, no Puppeteer).
 *
 * Supported functions:
 *  sendBookingConfirmation(booking, tenant)
 *  sendBookingCancellationEmail(booking, reason, tenant)
 *  sendOrderConfirmation(order, items, pdfPath, tenant)
 *  sendDesignInquiryEmail(data, tenant)
 */

const { Resend } = require('resend');

function getResend() {
    const key = process.env.RESEND_API_KEY;
    if (!key) return null;
    return new Resend(key);
}

/**
 * Tenant branding helpers
 */
function getBrand(tenant) {
    const b = tenant?.branding || {};
    return {
        name:        b.businessName  || tenant?.name || 'ICSS Booking',
        primaryColor: b.primaryColor || '#D4AF37',
        logoUrl:     b.logoUrl       || null,
        replyEmail:  b.replyEmail    || process.env.ADMIN_EMAIL || 'noreply@icss.app',
        sendingDomain: b.sendingDomain || 'icss.app',
        bookingUrl:  b.bookingUrl    || 'https://icss.app'
    };
}

function getSenderAddress(prefix, brand) {
    return `${brand.name} <${prefix}@${brand.sendingDomain}>`;
}

function headerHtml(brand) {
    return `
    <div style="background:#050505;padding:28px 36px;text-align:center;">
        ${brand.logoUrl
            ? `<img src="${brand.logoUrl}" alt="${brand.name}" style="height:48px;margin-bottom:8px;">`
            : `<h1 style="color:${brand.primaryColor};font-family:Georgia,serif;letter-spacing:3px;margin:0;font-size:20px;font-weight:normal;">${brand.name.toUpperCase()}</h1>`
        }
    </div>`;
}

function footerHtml(brand) {
    return `
    <div style="background:#050505;padding:20px 36px;text-align:center;">
        <p style="color:#555;font-size:11px;margin:0;letter-spacing:1px;">${brand.name.toUpperCase()}</p>
        <p style="color:#444;font-size:11px;margin:6px 0 0;">${brand.bookingUrl}</p>
    </div>`;
}

function formatDate(dateStr) {
    try {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    } catch { return dateStr; }
}

function formatTime(timeStr) {
    try {
        const [h, m] = timeStr.split(':');
        const hour = parseInt(h, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const h12  = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
        return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
    } catch { return timeStr; }
}

// ── Booking Confirmation ───────────────────────────────────────────────────────
async function sendBookingConfirmation(booking, tenant) {
    const resend = getResend();
    if (!resend) {
        console.warn('[Email] No RESEND_API_KEY — skipping booking confirmation to:', booking.email);
        return;
    }

    const brand       = getBrand(tenant);
    const displayDate = formatDate(booking.booking_date);
    const displayTime = formatTime(typeof booking.booking_time === 'string'
        ? booking.booking_time.slice(0, 5)
        : String(booking.booking_time));
    const firstName   = (booking.name || '').split(' ')[0];

    await resend.emails.send({
        from:    getSenderAddress('appointments', brand),
        to:      [booking.email],
        cc:      [brand.replyEmail],
        replyTo: brand.replyEmail,
        subject: `Appointment Confirmed — ${brand.name}`,
        html: `
        <div style="font-family:Arial,sans-serif;color:#1a1a1a;max-width:600px;margin:0 auto;border:1px solid #e8e8e8;">
            ${headerHtml(brand)}
            <div style="padding:40px 36px;background:#fff;">
                <p style="font-size:15px;">Dear ${firstName},</p>
                <p style="font-size:15px;line-height:1.7;">Your appointment has been <strong>confirmed</strong>. We look forward to seeing you.</p>
                <div style="background:#f9f9f9;border-left:4px solid ${brand.primaryColor};padding:18px 22px;margin:24px 0;border-radius:2px;">
                    <p style="margin:0 0 4px;font-size:13px;text-transform:uppercase;letter-spacing:1.5px;color:#86868B;">Appointment Details</p>
                    <p style="margin:6px 0;font-size:15px;"><strong>Date:</strong> ${displayDate}</p>
                    <p style="margin:6px 0;font-size:15px;"><strong>Time:</strong> ${displayTime}</p>
                    ${booking.region ? `<p style="margin:6px 0;font-size:15px;"><strong>Location:</strong> ${booking.region}</p>` : ''}
                </div>
                <p style="font-size:14px;color:#555;line-height:1.7;">If you need to reschedule or cancel, please reply to this email or contact us directly.</p>
                <div style="text-align:center;margin:32px 0;">
                    <a href="${brand.bookingUrl}" style="background:${brand.primaryColor};color:#050505;padding:13px 30px;text-decoration:none;font-weight:bold;font-size:13px;letter-spacing:1px;text-transform:uppercase;border-radius:3px;display:inline-block;">Visit Our Website</a>
                </div>
                <p style="font-size:14px;color:#333;margin-top:28px;">Warm regards,<br><strong>${brand.name} Team</strong></p>
            </div>
            ${footerHtml(brand)}
        </div>`
    });

    console.log(`[Email] Booking confirmation sent to ${booking.email}`);
}

// ── Booking Cancellation ───────────────────────────────────────────────────────
async function sendBookingCancellationEmail(booking, reason, tenant) {
    const resend = getResend();
    if (!resend) {
        console.warn('[Email] No RESEND_API_KEY — skipping cancellation email to:', booking.email);
        return;
    }

    const brand       = getBrand(tenant);
    const displayDate = formatDate(booking.booking_date);
    const displayTime = formatTime(typeof booking.booking_time === 'string'
        ? booking.booking_time.slice(0, 5)
        : String(booking.booking_time));
    const firstName   = (booking.name || '').split(' ')[0] || 'Valued Client';

    await resend.emails.send({
        from:    getSenderAddress('appointments', brand),
        to:      [booking.email],
        replyTo: brand.replyEmail,
        subject: `Appointment Update — ${brand.name}`,
        html: `
        <div style="font-family:Arial,sans-serif;color:#1a1a1a;max-width:600px;margin:0 auto;border:1px solid #e8e8e8;">
            ${headerHtml(brand)}
            <div style="padding:40px 36px;background:#fff;">
                <p style="font-size:15px;">Dear ${firstName},</p>
                <p style="font-size:15px;line-height:1.7;">We sincerely apologise for the inconvenience. Your appointment has been <strong>cancelled by our team</strong>.</p>
                <div style="background:#f9f9f9;border-left:3px solid ${brand.primaryColor};padding:18px 22px;margin:24px 0;border-radius:2px;">
                    <p style="margin:0 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:1.5px;color:#86868B;">Cancelled Appointment</p>
                    <p style="margin:4px 0;font-size:15px;"><strong>Date:</strong> ${displayDate}</p>
                    <p style="margin:4px 0;font-size:15px;"><strong>Time:</strong> ${displayTime}</p>
                </div>
                ${reason ? `<div style="background:#fffcf0;border:1px solid #f0e08a;padding:14px 18px;border-radius:4px;margin-bottom:24px;">
                    <p style="margin:0;font-size:14px;color:#7a6500;"><strong>Note from our team:</strong> ${reason}</p>
                </div>` : ''}
                <p style="font-size:15px;line-height:1.7;">We would love to reschedule at your earliest convenience.</p>
                <div style="text-align:center;margin:32px 0;">
                    <a href="${brand.bookingUrl}" style="background:${brand.primaryColor};color:#050505;padding:13px 30px;text-decoration:none;font-weight:bold;font-size:13px;letter-spacing:1px;text-transform:uppercase;border-radius:3px;display:inline-block;">Book a New Appointment</a>
                </div>
                <p style="font-size:14px;color:#333;margin-top:28px;">Warm regards,<br><strong>${brand.name} Team</strong></p>
            </div>
            ${footerHtml(brand)}
        </div>`
    });

    console.log(`[Email] Cancellation email sent to ${booking.email}`);
}

// ── Order Confirmation ─────────────────────────────────────────────────────────
async function sendOrderConfirmation(order, items, tenant) {
    const resend = getResend();
    if (!resend) {
        console.warn('[Email] Skipping order confirmation (no Resend key).');
        return;
    }

    const brand = getBrand(tenant);
    const currencySymbol = order.currency === 'GBP' ? '£' : (order.currency === 'JMD' ? 'J$' : '$');

    // Generate PDF invoice
    let pdfAttachment = null;
    try {
        const { generateOrderInvoicePDF } = require('./pdf-generator');
        const pdfBuffer = await generateOrderInvoicePDF(order, items || [], tenant);
        pdfAttachment = {
            filename: `Invoice_${String(order.id).slice(0, 8).toUpperCase()}.pdf`,
            content:  pdfBuffer.toString('base64')
        };
    } catch (pdfErr) {
        console.error('[Email] PDF generation failed:', pdfErr.message);
    }

    await resend.emails.send({
        from:    getSenderAddress('orders', brand),
        to:      [order.customer_email],
        cc:      [brand.replyEmail],
        replyTo: brand.replyEmail,
        subject: `Order Confirmation — ${brand.name}`,
        html: `
        <div style="font-family:Arial,sans-serif;color:#1a1a1a;max-width:600px;margin:0 auto;border:1px solid #e8e8e8;">
            ${headerHtml(brand)}
            <div style="padding:40px 36px;background:#fff;">
                <h2 style="color:${brand.primaryColor};">Thank you for your order, ${order.customer_name}!</h2>
                <p>We have received your order totaling <strong>${currencySymbol}${Number(order.total_amount || 0).toLocaleString()} ${order.currency}</strong>.</p>
                <p>${pdfAttachment ? 'Your invoice is attached to this email.' : 'Our team will follow up with your invoice shortly.'} We look forward to serving you.</p>
                <p style="margin-top:28px;">Warm regards,<br><strong>${brand.name} Team</strong></p>
            </div>
            ${footerHtml(brand)}
        </div>`,
        attachments: pdfAttachment ? [pdfAttachment] : undefined
    });

    console.log(`[Email] Order confirmation sent to ${order.customer_email}`);
}

// ── Design Inquiry ─────────────────────────────────────────────────────────────
async function sendDesignInquiryEmail(data, tenant) {
    const resend = getResend();
    if (!resend) return;

    const brand       = getBrand(tenant);
    const adminEmail  = brand.replyEmail;
    const attachments = [];

    if (data.photoBase64) {
        attachments.push({ filename: data.photoName || 'inspiration.jpg', content: data.photoBase64 });
    }

    await resend.emails.send({
        from:    getSenderAddress('inquiries', brand),
        to:      [adminEmail],
        replyTo: data.customerEmail,
        subject: `New Design Inquiry: ${data.designName} — ${brand.name}`,
        html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e8e8e8;">
            ${headerHtml(brand)}
            <div style="padding:32px 36px;background:#fff;">
                <h3>New Design Inquiry</h3>
                <div style="background:#f9f9f9;padding:16px;border-left:4px solid ${brand.primaryColor};margin-bottom:20px;">
                    <p style="margin:4px 0;"><strong>Client:</strong> ${data.customerName}</p>
                    <p style="margin:4px 0;"><strong>Email:</strong> <a href="mailto:${data.customerEmail}">${data.customerEmail}</a></p>
                    <p style="margin:4px 0;"><strong>Phone:</strong> ${data.customerPhone || 'Not provided'}</p>
                </div>
                <h4>Design Details</h4>
                <p><strong>Design Name:</strong> ${data.designName}</p>
                <p><strong>Gender:</strong> ${data.gender || 'Not specified'}</p>
                <p><strong>Fabric:</strong> ${data.fabric || 'Not specified'}</p>
                <p><strong>Target Date:</strong> ${data.targetDate || 'Not specified'}</p>
                <h4>Description</h4>
                <p style="white-space:pre-wrap;">${data.description}</p>
                ${attachments.length > 0 ? '<p style="color:' + brand.primaryColor + ';"><em>* Inspiration photo attached.</em></p>' : ''}
            </div>
            ${footerHtml(brand)}
        </div>`,
        attachments: attachments.length > 0 ? attachments : undefined
    });

    console.log(`[Email] Design inquiry forwarded to ${adminEmail}`);
}

module.exports = {
    sendBookingConfirmation,
    sendBookingCancellationEmail,
    sendOrderConfirmation,
    sendDesignInquiryEmail
};
