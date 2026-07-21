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
const { query } = require('../db/connection');

function getResend() {
    const key = process.env.RESEND_API_KEY;
    if (!key) return null;
    const client = new Resend(key);
    const providerSend = client.emails.send.bind(client.emails);
    client.emails.send = async payload => {
        const result = await providerSend(payload);
        if (result?.error) throw new Error(result.error.message || result.error.name || 'Email provider rejected the message.');
        return result?.data || result;
    };
    return client;
}

function getEmailSafeAssetUrl(value) {
    const url = String(value || '').trim();
    if (!url) return null;

    // Gmail clips or breaks on large inline data URIs. Only use public URLs in emails.
    if (url.startsWith('data:')) return null;
    if (!/^https?:\/\//i.test(url)) return null;

    return url;
}

function getPlatformAdminEmail() {
    return String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
}

function getDefaultNotificationEmail() {
    return String(
        process.env.BUSINESS_NOTIFICATION_EMAIL ||
        process.env.DEFAULT_NOTIFICATION_EMAIL ||
        'icssbookingsystem@gmail.com'
    ).trim().toLowerCase();
}

function getSupportContactEmail() {
    return getPlatformAdminEmail() || getDefaultNotificationEmail() || 'icssbookingsystem@gmail.com';
}

function isPlatformAdminMailbox(email) {
    const candidate = String(email || '').trim().toLowerCase();
    const platformAdminEmail = getPlatformAdminEmail();
    return !!candidate && !!platformAdminEmail && candidate === platformAdminEmail;
}

function getReplyEmail(tenant) {
    const configuredReplyEmail = String(tenant?.branding?.replyEmail || '').trim().toLowerCase();
    if (configuredReplyEmail && !isPlatformAdminMailbox(configuredReplyEmail)) {
        return configuredReplyEmail;
    }

    return getDefaultNotificationEmail() || 'noreply@icssbookings.com';
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Tenant branding helpers
 */
function getBrand(tenant) {
    const b = tenant?.branding || {};
    return {
        name:        b.businessName  || tenant?.name || 'ICSS Booking',
        primaryColor: b.primaryColor || '#D4AF37',
        logoUrl:     getEmailSafeAssetUrl(b.logoUrl),
        replyEmail:  getReplyEmail(tenant),
        sendingDomain: b.sendingDomain || 'icssbookings.com',
        bookingUrl:  b.bookingUrl    || 'https://icssbookings.com'
    };
}

function getSenderAddress(prefix, brand) {
    return `${brand.name} <${prefix}@${brand.sendingDomain}>`;
}

function splitEmails(value) {
    return String(value || '')
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean);
}

async function getTenantNotificationRecipients(tenant) {
    const recipients = new Set();
    const defaultNotificationEmail = getDefaultNotificationEmail();

    splitEmails(tenant?.branding?.replyEmail).forEach((email) => {
        if (!isPlatformAdminMailbox(email)) {
            recipients.add(email);
        }
    });

    if (defaultNotificationEmail && !isPlatformAdminMailbox(defaultNotificationEmail)) {
        recipients.add(defaultNotificationEmail);
    }

    if (!tenant?.id) {
        return Array.from(recipients);
    }

    try {
        const result = await query(
            `SELECT DISTINCT LOWER(email) AS email
             FROM users
             WHERE tenant_id = $1
               AND active = true
               AND role IN ('tenant_admin', 'staff', 'super_admin')`,
            [tenant.id]
        );

        result.rows.forEach((row) => {
            if (row.email && !isPlatformAdminMailbox(row.email)) {
                recipients.add(row.email);
            }
        });
    } catch (err) {
        console.error('[Email] Failed to load tenant notification recipients:', err.message);
    }

    return Array.from(recipients);
}

async function getBookingServiceDetails(booking) {
    if ((!booking?.service_id || !booking?.tenant_id) && booking?.service_name) {
        return {
            name: booking.service_name,
            durationMinutes: Number(booking.duration_minutes || 0) || null
        };
    }

    if (booking?.service_name && booking?.duration_minutes !== undefined && booking?.duration_minutes !== null) {
        return {
            name: booking.service_name,
            durationMinutes: Number(booking.duration_minutes || 0) || null
        };
    }

    if (!booking?.service_id || !booking?.tenant_id) {
        return {
            name: booking?.service_name || null,
            durationMinutes: Number(booking?.duration_minutes || 0) || null
        };
    }

    try {
        const result = await query(
            `SELECT name, duration_minutes FROM services WHERE id = $1 AND tenant_id = $2`,
            [booking.service_id, booking.tenant_id]
        );
        return {
            name: result.rows[0]?.name || booking?.service_name || null,
            durationMinutes: Number(result.rows[0]?.duration_minutes || booking?.duration_minutes || 0) || null
        };
    } catch (err) {
        console.error('[Email] Failed to load service details:', err.message);
        return {
            name: booking?.service_name || null,
            durationMinutes: Number(booking?.duration_minutes || 0) || null
        };
    }
}

function buildAttachmentFromDataUrl(dataUrl, fallbackBaseName = 'attachment') {
    const raw = String(dataUrl || '').trim();
    if (!raw) return null;

    const dataUrlMatch = raw.match(/^data:([^;]+);base64,(.+)$/);
    const mimeType = dataUrlMatch?.[1] || 'application/octet-stream';
    const base64Content = (dataUrlMatch?.[2] || raw).trim();
    if (!base64Content) return null;

    const extensionMap = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'application/pdf': 'pdf'
    };
    const extension = extensionMap[mimeType.toLowerCase()] || 'bin';

    return {
        filename: `${fallbackBaseName}.${extension}`,
        content: base64Content
    };
}

function getBookingDateString(dateValue) {
    if (!dateValue) return null;

    if (dateValue instanceof Date && !Number.isNaN(dateValue.getTime())) {
        return dateValue.toISOString().split('T')[0];
    }

    const match = String(dateValue).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function getBookingTimeString(timeValue) {
    if (!timeValue) return null;

    const match = String(timeValue).trim().match(/^(\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!match) return null;

    return `${match[1]}:${match[2]}:${match[3] || '00'}`;
}

function zonedDateTimeToUtc(dateValue, timeValue, timeZone = 'America/Jamaica') {
    const dateStr = getBookingDateString(dateValue);
    const timeStr = getBookingTimeString(timeValue);
    if (!dateStr || !timeStr) return null;

    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, minutes, seconds] = timeStr.split(':').map(Number);
    const utcGuess = new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds || 0));

    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    const parts = Object.fromEntries(
        formatter
            .formatToParts(utcGuess)
            .filter((part) => part.type !== 'literal')
            .map((part) => [part.type, part.value])
    );

    const renderedUtc = Date.UTC(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        Number(parts.hour),
        Number(parts.minute),
        Number(parts.second)
    );

    return new Date(utcGuess.getTime() - (renderedUtc - utcGuess.getTime()));
}

function formatUtcCalendarStamp(date) {
    const pad = (value) => String(value).padStart(2, '0');
    return [
        date.getUTCFullYear(),
        pad(date.getUTCMonth() + 1),
        pad(date.getUTCDate())
    ].join('') + `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function escapeCalendarText(value) {
    return String(value || '')
        .replace(/\\/g, '\\\\')
        .replace(/\r?\n/g, '\\n')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;');
}

function buildBookingCalendarAssets({ booking, tenant, brand, serviceName, durationMinutes }) {
    const timeZone = tenant?.branding?.timezone || 'America/Jamaica';
    const startUtc = zonedDateTimeToUtc(booking?.booking_date, booking?.booking_time, timeZone);
    if (!startUtc) {
        return { googleCalendarUrl: null, icsAttachment: null };
    }

    const safeDurationMinutes = Math.max(30, Number(durationMinutes || 0) || 60);
    const endUtc = new Date(startUtc.getTime() + (safeDurationMinutes * 60 * 1000));
    const summary = `${serviceName || 'Appointment'} @ ${tenant?.name || brand.name}`;
    const location = booking?.region || tenant?.branding?.location || tenant?.name || brand.name;
    const details = [
        `Appointment confirmed with ${tenant?.name || brand.name}.`,
        serviceName ? `Service: ${serviceName}` : null,
        `Date: ${formatDate(booking?.booking_date)}`,
        `Time: ${formatTime(getBookingTimeString(booking?.booking_time) || String(booking?.booking_time || ''))}`
    ].filter(Boolean).join('\n');

    const googleParams = new URLSearchParams({
        action: 'TEMPLATE',
        text: summary,
        dates: `${formatUtcCalendarStamp(startUtc)}/${formatUtcCalendarStamp(endUtc)}`,
        details,
        location,
        ctz: timeZone
    });

    const calendarFile = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//ICSS Booking System//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:${booking?.id || Date.now()}@icssbookings.com`,
        `DTSTAMP:${formatUtcCalendarStamp(new Date())}`,
        `DTSTART:${formatUtcCalendarStamp(startUtc)}`,
        `DTEND:${formatUtcCalendarStamp(endUtc)}`,
        `SUMMARY:${escapeCalendarText(summary)}`,
        `DESCRIPTION:${escapeCalendarText(details)}`,
        `LOCATION:${escapeCalendarText(location)}`,
        'STATUS:CONFIRMED',
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n');

    return {
        googleCalendarUrl: `https://calendar.google.com/calendar/render?${googleParams.toString()}`,
        icsAttachment: {
            filename: `appointment-${booking?.id || 'confirmed'}.ics`,
            content: Buffer.from(calendarFile, 'utf8').toString('base64')
        }
    };
}

async function getBookingReceiptAttachment(booking) {
    if (!booking?.id) return null;

    try {
        const result = await query(
            `SELECT gateway_response
             FROM booking_payments
             WHERE booking_id = $1
             ORDER BY created_at DESC
             LIMIT 1`,
            [booking.id]
        );

        const gatewayResponse = result.rows[0]?.gateway_response || {};
        const receiptImage = gatewayResponse.receipt_image || gatewayResponse.receiptImage || null;
        return buildAttachmentFromDataUrl(receiptImage, `bank-transfer-receipt-${booking.id}`);
    } catch (err) {
        console.error('[Email] Failed to load booking receipt attachment:', err.message);
        return null;
    }
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
        // booking_date can arrive as a Date object or a string like '2026-04-30' or '2026-04-30T00:00:00.000Z'
        const raw = dateStr instanceof Date ? dateStr.toISOString().split('T')[0]
                  : String(dateStr).includes('T') ? String(dateStr).split('T')[0]
                  : String(dateStr);
        const d = new Date(raw + 'T00:00:00');
        if (isNaN(d.getTime())) return String(dateStr);
        return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    } catch { return String(dateStr); }
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

    const brand = getBrand(tenant);
    const serviceDetails = await getBookingServiceDetails(booking);
    const serviceName = serviceDetails.name;
    const displayDate = formatDate(booking.booking_date);
    const displayTime = formatTime(typeof booking.booking_time === 'string'
        ? booking.booking_time.slice(0, 5)
        : String(booking.booking_time));
    const firstName = (booking.name || '').split(' ')[0];
    const customerEmail = (booking.email || '').toLowerCase().trim();
    const tenantRecipients = (await getTenantNotificationRecipients(tenant))
        .filter((recipient) => recipient !== customerEmail);
    const { googleCalendarUrl, icsAttachment } = buildBookingCalendarAssets({
        booking,
        tenant,
        brand,
        serviceName,
        durationMinutes: serviceDetails.durationMinutes
    });

    await resend.emails.send({
        from:    getSenderAddress('appointments', brand),
        to:      [booking.email],
        cc:      tenantRecipients.length > 0 ? tenantRecipients : undefined,
        replyTo: brand.replyEmail,
        subject: `Appointment Confirmed — ${brand.name}`,
        html: `
        <div style="font-family:Arial,sans-serif;color:#1a1a1a;max-width:600px;margin:0 auto;border:1px solid #e8e8e8;">
            ${headerHtml(brand)}
            <div style="padding:40px 36px;background:#fff;">
                <p style="font-size:15px;">Dear ${firstName},</p>
                <p style="font-size:15px;line-height:1.7;">Your appointment with <strong>${brand.name}</strong> has been <strong>confirmed</strong>. We look forward to seeing you!</p>
                <div style="background:#f9f9f9;border-left:4px solid ${brand.primaryColor};padding:18px 22px;margin:24px 0;border-radius:2px;">
                    <p style="margin:0 0 4px;font-size:13px;text-transform:uppercase;letter-spacing:1.5px;color:#86868B;">Appointment Details</p>
                    ${serviceName ? `<p style="margin:6px 0;font-size:15px;"><strong>Service:</strong> ${serviceName}</p>` : ''}
                    <p style="margin:6px 0;font-size:15px;"><strong>Date:</strong> ${displayDate}</p>
                    <p style="margin:6px 0;font-size:15px;"><strong>Time:</strong> ${displayTime}</p>
                    ${booking.is_after_hours_request ? `<p style="margin:6px 0;font-size:15px;"><strong>After-hours cost:</strong> JMD ${Number(booking.after_hours_fee || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>` : ''}
                    ${booking.region ? `<p style="margin:6px 0;font-size:15px;"><strong>Location:</strong> ${booking.region}</p>` : ''}
                </div>
                ${(googleCalendarUrl || icsAttachment) ? `
                <div style="background:#fffaf0;border:1px solid rgba(0,0,0,0.08);padding:18px 22px;margin:24px 0;border-radius:6px;">
                    <p style="margin:0 0 12px;font-size:13px;text-transform:uppercase;letter-spacing:1.5px;color:#86868B;">Add to Calendar</p>
                    ${googleCalendarUrl ? `
                    <div style="margin-bottom:12px;">
                        <a href="${googleCalendarUrl}" style="background:${brand.primaryColor};color:#050505;padding:12px 20px;text-decoration:none;font-weight:bold;font-size:13px;letter-spacing:1px;text-transform:uppercase;border-radius:4px;display:inline-block;">Add to Google Calendar</a>
                    </div>` : ''}
                    ${icsAttachment ? `
                    <p style="margin:0;font-size:14px;color:#555;line-height:1.7;">
                        An <strong>.ics</strong> calendar file is attached to this email for Apple Calendar, Outlook, and other calendar apps.
                    </p>` : ''}
                </div>` : ''}
                <p style="font-size:14px;color:#555;line-height:1.7;">If you need to reschedule or cancel, please reply to this email or contact us directly.</p>
                <div style="text-align:center;margin:32px 0;">
                    <a href="${brand.bookingUrl}" style="background:${brand.primaryColor};color:#050505;padding:13px 30px;text-decoration:none;font-weight:bold;font-size:13px;letter-spacing:1px;text-transform:uppercase;border-radius:3px;display:inline-block;">Visit Our Website</a>
                </div>
                <p style="font-size:14px;color:#333;margin-top:28px;">Warm regards,<br><strong>${brand.name} Team</strong></p>
            </div>
            ${footerHtml(brand)}
        </div>`,
        attachments: icsAttachment ? [icsAttachment] : undefined
    });

    console.log(`[Email] Booking confirmation sent to ${booking.email}`);
}

// ── Booking Pending Review ────────────────────────────────────────────────────
async function sendBookingPendingReviewEmail(booking, tenant) {
    const resend = getResend();
    if (!resend) {
        console.warn('[Email] No RESEND_API_KEY — skipping pending review email to:', booking.email);
        return;
    }

    const brand = getBrand(tenant);
    const serviceDetails = await getBookingServiceDetails(booking);
    const serviceName = serviceDetails.name;
    const displayDate = formatDate(booking.booking_date);
    const displayTime = formatTime(typeof booking.booking_time === 'string'
        ? booking.booking_time.slice(0, 5)
        : String(booking.booking_time));
    const firstName = (booking.name || '').split(' ')[0] || 'there';
    const customerEmail = (booking.email || '').toLowerCase().trim();
    const tenantRecipients = (await getTenantNotificationRecipients(tenant))
        .filter((recipient) => recipient !== customerEmail);
    const receiptAttachment = await getBookingReceiptAttachment(booking);
    const isAfterHours = booking.status === 'pending_after_hours_confirmation' || booking.is_after_hours_request;
    const feeText = `${booking.currency || 'JMD'} ${Number(booking.after_hours_fee || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

    await resend.emails.send({
        from:    getSenderAddress('appointments', brand),
        to:      [booking.email],
        cc:      tenantRecipients.length > 0 ? tenantRecipients : undefined,
        replyTo: brand.replyEmail,
        subject: `${isAfterHours ? 'After-hours Request' : 'Booking Received'} — Pending Review · ${brand.name}`,
        html: `
        <div style="font-family:Arial,sans-serif;color:#1a1a1a;max-width:600px;margin:0 auto;border:1px solid #e8e8e8;">
            ${headerHtml(brand)}
            <div style="padding:40px 36px;background:#fff;">
                <p style="font-size:15px;">Dear ${firstName},</p>
                <p style="font-size:15px;line-height:1.7;">${isAfterHours ? 'We received your requested time. It is outside regular business hours and must be approved by the business before it becomes a confirmed booking.' : 'We received your booking request and your payment proof has been submitted for review.'}</p>
                <div style="background:#f9f9f9;border-left:4px solid ${brand.primaryColor};padding:18px 22px;margin:24px 0;border-radius:2px;">
                    <p style="margin:0 0 4px;font-size:13px;text-transform:uppercase;letter-spacing:1.5px;color:#86868B;">Booking Details</p>
                    ${serviceName ? `<p style="margin:6px 0;font-size:15px;"><strong>Service:</strong> ${serviceName}</p>` : ''}
                    <p style="margin:6px 0;font-size:15px;"><strong>Date:</strong> ${displayDate}</p>
                    <p style="margin:6px 0;font-size:15px;"><strong>Time:</strong> ${displayTime}</p>
                    ${isAfterHours ? `<p style="margin:6px 0;font-size:15px;"><strong>Additional after-hours cost:</strong> ${feeText}</p>` : ''}
                </div>
                <p style="font-size:14px;color:#555;line-height:1.7;">${isAfterHours ? 'The business will confirm or decline the requested time. No appointment is confirmed yet.' : 'We will confirm the booking as soon as the receipt is approved.'} A copy of this email has also been sent to the business team.</p>
                <p style="font-size:14px;color:#333;margin-top:28px;">Warm regards,<br><strong>${brand.name} Team</strong></p>
            </div>
            ${footerHtml(brand)}
        </div>`
    });

    if (tenantRecipients.length > 0) {
        await resend.emails.send({
            from:    getSenderAddress('appointments', brand),
            to:      tenantRecipients,
            replyTo: brand.replyEmail,
            subject: `${isAfterHours ? 'After-hours Request Review Needed' : 'Receipt Review Needed'} — ${brand.name}`,
            html: `
            <div style="font-family:Arial,sans-serif;color:#1a1a1a;max-width:600px;margin:0 auto;border:1px solid #e8e8e8;">
                ${headerHtml(brand)}
                <div style="padding:40px 36px;background:#fff;">
                    <h3 style="margin-top:0;">${isAfterHours ? 'After-hours request review required' : 'Manual transfer review required'}</h3>
                    <p style="font-size:15px;line-height:1.7;">${isAfterHours ? 'A client requested a time outside your regular business hours.' : 'A client submitted a bank transfer receipt for review.'}</p>
                    <div style="background:#f9f9f9;border-left:4px solid ${brand.primaryColor};padding:18px 22px;margin:24px 0;border-radius:2px;">
                        <p style="margin:6px 0;font-size:15px;"><strong>Client:</strong> ${booking.name || 'Unknown client'}</p>
                        <p style="margin:6px 0;font-size:15px;"><strong>Email:</strong> ${booking.email || '—'}</p>
                        <p style="margin:6px 0;font-size:15px;"><strong>Phone:</strong> ${booking.phone || '—'}</p>
                        ${serviceName ? `<p style="margin:6px 0;font-size:15px;"><strong>Service:</strong> ${serviceName}</p>` : ''}
                        <p style="margin:6px 0;font-size:15px;"><strong>Date:</strong> ${displayDate}</p>
                        <p style="margin:6px 0;font-size:15px;"><strong>Time:</strong> ${displayTime}</p>
                        ${isAfterHours ? `<p style="margin:6px 0;font-size:15px;"><strong>Additional cost:</strong> ${feeText}</p>` : ''}
                    </div>
                    <p style="font-size:14px;color:#555;line-height:1.7;">
                        ${isAfterHours ? 'Open the Bookings page to approve or decline this request.' : (receiptAttachment ? 'The uploaded transfer receipt is attached to this email for review.' : 'No receipt attachment could be recovered from the booking record.')}
                    </p>
                </div>
                ${footerHtml(brand)}
            </div>`,
            attachments: !isAfterHours && receiptAttachment ? [receiptAttachment] : undefined
        });
    }

    console.log(`[Email] Pending review notice sent to ${booking.email}`);
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
    const customerEmail = (booking.email || '').toLowerCase().trim();
    const tenantRecipients = (await getTenantNotificationRecipients(tenant))
        .filter((recipient) => recipient !== customerEmail);

    await resend.emails.send({
        from:    getSenderAddress('appointments', brand),
        to:      [booking.email],
        cc:      tenantRecipients.length > 0 ? tenantRecipients : undefined,
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

// ── Booking Fulfilled ─────────────────────────────────────────────────────────
async function sendBookingCompletedEmail(booking, tenant) {
    const resend = getResend();
    if (!resend || !booking?.email) return false;
    const brand = getBrand(tenant);
    const service = await getBookingServiceDetails(booking);
    const firstName = escapeHtml((booking.name || '').split(' ')[0] || 'there');
    const displayDate = formatDate(booking.booking_date);
    const displayTime = formatTime(String(booking.booking_time || '').slice(0, 5));

    await resend.emails.send({
        from: getSenderAddress('appointments', brand),
        to: [booking.email],
        replyTo: brand.replyEmail,
        subject: `Appointment Completed — ${brand.name}`,
        html: `<div style="font-family:Arial,sans-serif;color:#1a1a1a;max-width:600px;margin:0 auto;border:1px solid #e8e8e8;">
            ${headerHtml(brand)}
            <div style="padding:40px 36px;background:#fff;">
                <p style="font-size:15px;">Dear ${firstName},</p>
                <h2 style="margin:0 0 12px;">Your appointment is complete</h2>
                <p style="font-size:15px;line-height:1.7;">${escapeHtml(brand.name)} has marked your booking as fulfilled. Thank you for choosing us.</p>
                <div style="background:#f9f9f9;border-left:4px solid ${brand.primaryColor};padding:18px 22px;margin:24px 0;">
                    ${service.name ? `<p style="margin:6px 0;"><strong>Service:</strong> ${escapeHtml(service.name)}</p>` : ''}
                    <p style="margin:6px 0;"><strong>Date:</strong> ${escapeHtml(displayDate)}</p>
                    <p style="margin:6px 0;"><strong>Time:</strong> ${escapeHtml(displayTime)}</p>
                </div>
                <p style="font-size:14px;color:#555;line-height:1.7;">If anything about this booking needs attention, reply to this email and the business will assist you.</p>
            </div>${footerHtml(brand)}
        </div>`
    });
    console.log(`[Email] Booking completion sent to ${booking.email}`);
    return true;
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
    const customerEmail = (order.customer_email || '').toLowerCase().trim();
    const tenantRecipients = (await getTenantNotificationRecipients(tenant))
        .filter((recipient) => recipient !== customerEmail);

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
        cc:      tenantRecipients.length > 0 ? tenantRecipients : undefined,
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

async function sendSupportRequestEmail({ tenant, user, category, subject, message, pageUrl }) {
    const resend = getResend();
    const supportEmail = getSupportContactEmail();
    const tenantName = tenant?.name || tenant?.branding?.businessName || 'ICSS Tenant';
    const tenantSlug = tenant?.slug || 'unknown';
    const senderEmail = String(user?.email || '').trim().toLowerCase();
    const senderName = user?.name || senderEmail || 'Unknown user';
    const senderRole = user?.role || 'tenant_admin';
    const safeCategory = escapeHtml(category || 'general');
    const safeSubject = escapeHtml(subject || 'Support request');
    const safeMessage = escapeHtml(message || '').replace(/\r?\n/g, '<br>');
    const safePageUrl = escapeHtml(pageUrl || 'Unknown page');

    if (!resend) {
        console.warn('[Email] No RESEND_API_KEY — skipping support request delivery.');
        console.log('[Email] Support request payload:', {
            tenant: tenantName,
            tenantSlug,
            senderEmail,
            senderName,
            senderRole,
            category,
            subject,
            message,
            pageUrl
        });
        return;
    }

    await resend.emails.send({
        from: 'ICSS Support <support@icssbookings.com>',
        to: [supportEmail],
        replyTo: senderEmail || undefined,
        subject: `Support Request — ${tenantName} — ${subject || 'General help'}`,
        html: `
        <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
            <div style="background:#0f172a;padding:24px 28px;">
                <p style="margin:0 0 8px;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#94a3b8;">ICSS Support Request</p>
                <h2 style="margin:0;color:#fff;font-size:22px;line-height:1.2;">${safeSubject}</h2>
            </div>
            <div style="padding:28px;background:#fff;color:#0f172a;">
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:18px 20px;margin-bottom:22px;">
                    <p style="margin:0 0 8px;font-size:13px;"><strong>Tenant:</strong> ${escapeHtml(tenantName)}</p>
                    <p style="margin:0 0 8px;font-size:13px;"><strong>Handle:</strong> ${escapeHtml(tenantSlug)}</p>
                    <p style="margin:0 0 8px;font-size:13px;"><strong>Submitted by:</strong> ${escapeHtml(senderName)}</p>
                    <p style="margin:0 0 8px;font-size:13px;"><strong>Email:</strong> ${escapeHtml(senderEmail || 'Not available')}</p>
                    <p style="margin:0 0 8px;font-size:13px;"><strong>Role:</strong> ${escapeHtml(senderRole)}</p>
                    <p style="margin:0 0 8px;font-size:13px;"><strong>Category:</strong> ${safeCategory}</p>
                    <p style="margin:0;font-size:13px;"><strong>Page:</strong> ${safePageUrl}</p>
                </div>

                <h3 style="margin:0 0 10px;font-size:15px;color:#334155;">Issue Details</h3>
                <div style="font-size:14px;line-height:1.7;color:#1e293b;background:#fff;border-left:4px solid #7c6ef7;padding:4px 0 4px 16px;">
                    ${safeMessage}
                </div>
            </div>
        </div>`
    });

    console.log(`[Email] Support request sent for tenant ${tenantSlug} by ${senderEmail || senderName}`);
}

async function sendPasswordResetEmail(email, resetUrl) {
    const resend = getResend();
    if (!resend) {
        console.warn('[Email] No RESEND_API_KEY — skipping password reset email to:', email);
        console.log(`[Email] Fake send: Reset URL is ${resetUrl}`);
        return;
    }

    await resend.emails.send({
        from:    'ICSS Booking <security@icssbookings.com>',
        to:      [email],
        subject: `Password Reset Request - ICSS Booking System`,
        html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e8e8e8;border-radius:8px;overflow:hidden;">
            <div style="background:#050505;padding:24px;text-align:center;">
                <h2 style="color:#fff;margin:0;font-family:Georgia,serif;letter-spacing:2px;">PASSWORD RESET</h2>
            </div>
            <div style="padding:32px 36px;background:#fff;color:#333;">
                <p>Hello,</p>
                <p>We received a request to reset your password. Click the button below to set a new password. This link is valid for 1 hour.</p>
                <div style="text-align:center;margin:30px 0;">
                    <a href="${resetUrl}" style="background:#050505;color:#fff;text-decoration:none;padding:14px 28px;border-radius:4px;font-weight:bold;display:inline-block;letter-spacing:1px;">RESET PASSWORD</a>
                </div>
                <p>If you did not request a password reset, you can safely ignore this email.</p>
            </div>
            <div style="background:#f9f9f9;padding:20px;text-align:center;font-size:12px;color:#999;border-top:1px solid #eee;">
                <p style="margin:0;">&copy; ${new Date().getFullYear()} ICSS Booking System. All rights reserved.</p>
            </div>
        </div>`
    });

    console.log(`[Email] Password reset sent to ${email}`);
}

async function sendSignupWelcomeEmail(email, firstName, tenantName, options = {}) {
    const resend = getResend();
    if (!resend) {
        throw new Error('RESEND_API_KEY is required to deliver the signup welcome email.');
    }

    const trialDays = Number(options.trialDays || 7);
    const monthlyPriceUsd = Number(options.monthlyPriceUsd || 31.67).toFixed(2);

    const sent = await resend.emails.send({
        from:    'ICSS Booking <welcome@icssbookings.com>',
        to:      [email],
        subject: `Welcome to ICSS Booking System`,
        html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e8e8e8;border-radius:8px;overflow:hidden;">
            <div style="background:#050505;padding:24px;text-align:center;">
                <h2 style="color:#fff;margin:0;font-family:Georgia,serif;letter-spacing:2px;">WELCOME TO ICSS</h2>
            </div>
            <div style="padding:32px 36px;background:#fff;color:#333;">
                <p>Hello ${firstName || 'there'},</p>
                <p>Thanks for signing up for <strong>${tenantName}</strong> on ICSS Booking System.</p>
                <p>Your <strong>${trialDays}-day free trial</strong> is being activated now. After the trial, your subscription continues at <strong>$${monthlyPriceUsd} USD/month</strong> unless you cancel.</p>
                <p>We are now preparing your booking platform and will send you into your dashboard as soon as setup is complete.</p>
                <p>If you have any questions, just reply to this email and our team will help.</p>
                <p>Warm regards,<br><strong>The ICSS Team</strong></p>
            </div>
            <div style="background:#f9f9f9;padding:20px;text-align:center;font-size:12px;color:#999;border-top:1px solid #eee;">
                <p style="margin:0;">&copy; ${new Date().getFullYear()} ICSS Booking System. All rights reserved.</p>
            </div>
        </div>`
    });

    console.log(`[Email] Signup welcome email sent to ${email}`);
    return sent;
}

async function sendWelcomeEmail(email, firstName, tenantName, options = {}) {
    const resend = getResend();
    if (!resend) {
        throw new Error('RESEND_API_KEY is required to deliver the platform-ready email.');
    }

    const baseUrl = String(process.env.PUBLIC_APP_URL || process.env.BASE_URL || 'https://icssbookings.com').replace(/\/$/, '');
    const tenantSlug = String(options.tenantSlug || '').trim();
    const dashboardUrl = `${baseUrl}/admin`;
    const bookingUrl = tenantSlug ? `${baseUrl}/${encodeURIComponent(tenantSlug)}` : baseUrl;
    const sent = await resend.emails.send({
        from:    'ICSS Booking <welcome@icssbookings.com>',
        to:      [email],
        subject: `Your ICSS Booking Platform Is Ready`,
        html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e8e8e8;border-radius:8px;overflow:hidden;">
            <div style="background:#050505;padding:24px;text-align:center;">
                <h2 style="color:#fff;margin:0;font-family:Georgia,serif;letter-spacing:2px;">PLATFORM READY</h2>
            </div>
            <div style="padding:32px 36px;background:#fff;color:#333;">
                <p>Hello ${escapeHtml(firstName || 'there')},</p>
                <p>Your ICSS Booking setup for <strong>${escapeHtml(tenantName)}</strong> is complete.</p>
                ${tenantSlug ? `<p><strong>Business handle:</strong> ${escapeHtml(tenantSlug)}<br><strong>Public booking page:</strong> <a href="${bookingUrl}">${bookingUrl}</a></p>` : ''}
                <p>First login checklist:</p><ol><li>Review your services and prices</li><li>Set your availability and timezone</li><li>Add your PayPal or bank-transfer details</li><li>Customize your branding</li><li>Preview and share your booking link</li></ol>
                <div style="text-align:center;margin:30px 0;">
                    <a href="${dashboardUrl}" style="background:#7C6EF7;color:#fff;text-decoration:none;padding:14px 28px;border-radius:4px;font-weight:bold;display:inline-block;letter-spacing:1px;">GO TO DASHBOARD</a>
                </div>
                <p>If you need help, reply to this email or use Report Issue inside your dashboard.</p>
                <p>Warm regards,<br><strong>The ICSS Team</strong></p>
            </div>
            <div style="background:#f9f9f9;padding:20px;text-align:center;font-size:12px;color:#999;border-top:1px solid #eee;">
                <p style="margin:0;">&copy; ${new Date().getFullYear()} ICSS Booking System. All rights reserved.</p>
            </div>
        </div>`
    });

    console.log(`[Email] Welcome email sent to ${email}`);
    return sent;
}

async function sendSubscriptionInvoiceEmail({ to, ownerName, businessName, amount, currency = 'USD',
                                               invoiceNumber, paidAt, pdfBuffer }) {
    const resend = getResend();
    if (!resend) {
        console.warn('[Email] No RESEND_API_KEY — skipping subscription invoice to:', to);
        return;
    }

    const currSym   = currency === 'GBP' ? '£' : currency === 'JMD' ? 'J$' : '$';
    const amtStr    = `${currSym}${Number(amount).toFixed(2)} ${currency}`;
    const firstName = (ownerName || '').split(' ')[0] || 'there';
    const paidDate  = paidAt
        ? new Date(paidAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const htmlBody = `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;color:#1a1a2e;max-width:600px;margin:0 auto;border:1px solid #e2e2f0;border-radius:8px;overflow:hidden;">

      <!-- Header -->
      <div style="background:#0F0F1A;padding:32px 36px 24px;">
        <p style="color:#A0A0B8;font-size:10px;letter-spacing:2px;margin:0 0 8px;text-transform:uppercase;">ICSS Booking System</p>
        <h1 style="color:#ffffff;font-size:22px;margin:0;font-weight:700;line-height:1.2;">Payment Received</h1>
        <div style="margin-top:16px;display:inline-block;background:#7C6EF7;color:#fff;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:600;letter-spacing:0.5px;">✓ Subscription Active</div>
      </div>

      <!-- Violet accent bar -->
      <div style="height:4px;background:#7C6EF7;"></div>

      <!-- Body -->
      <div style="padding:36px;background:#fff;">
        <p style="font-size:15px;margin:0 0 18px;">Hi ${firstName},</p>
        <p style="font-size:15px;line-height:1.7;margin:0 0 24px;">
          We have successfully processed your subscription payment for
          <strong>${businessName || 'your account'}</strong>.
          Your invoice is attached to this email for your records.
        </p>

        <!-- Summary card -->
        <div style="background:#F7F7FB;border-left:4px solid #7C6EF7;border-radius:4px;padding:20px 24px;margin:0 0 28px;">
          <p style="font-size:11px;color:#A0A0B8;letter-spacing:1.5px;margin:0 0 12px;text-transform:uppercase;">Payment Summary</p>
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="font-size:13px;color:#555566;padding:4px 0;">Invoice Number</td>
              <td style="font-size:13px;color:#0F0F1A;font-weight:600;text-align:right;">${invoiceNumber}</td>
            </tr>
            <tr>
              <td style="font-size:13px;color:#555566;padding:4px 0;">Payment Date</td>
              <td style="font-size:13px;color:#0F0F1A;font-weight:600;text-align:right;">${paidDate}</td>
            </tr>
            <tr style="border-top:1px solid #E0E0EE;">
              <td style="font-size:16px;color:#0F0F1A;font-weight:700;padding:12px 0 0;">Total Paid</td>
              <td style="font-size:20px;color:#7C6EF7;font-weight:700;text-align:right;padding:12px 0 0;">${amtStr}</td>
            </tr>
          </table>
        </div>

        <p style="font-size:13px;color:#888899;line-height:1.6;margin:0 0 28px;">
          Your subscription invoice is attached as a PDF. Keep it for your records or accounting purposes.
          If you have any questions, our billing team is here to help.
        </p>

        <!-- CTA -->
        <div style="text-align:center;margin:32px 0;">
          <a href="https://icssbookings.com/admin"
             style="background:#7C6EF7;color:#ffffff;text-decoration:none;padding:14px 32px;
                    border-radius:6px;font-size:13px;font-weight:700;letter-spacing:0.5px;display:inline-block;">
            Go to Dashboard →
          </a>
        </div>

        <p style="font-size:13px;color:#888899;margin:0;">
          Need help? Email us at
          <a href="mailto:billing@icssbookings.com" style="color:#7C6EF7;text-decoration:none;">billing@icssbookings.com</a>
        </p>
      </div>

      <!-- Footer -->
      <div style="background:#0F0F1A;padding:20px 36px;text-align:center;border-top:3px solid #7C6EF7;">
        <p style="color:#555566;font-size:11px;margin:0;">ICSS Booking System · https://icssbookings.com</p>
        <p style="color:#444455;font-size:10px;margin:6px 0 0;">&copy; ${new Date().getFullYear()} ICSS. All rights reserved.</p>
      </div>
    </div>`;

    const textBody = [
        'ICSS Booking System — Payment Received',
        '=======================================',
        '',
        `Hi ${firstName},`,
        '',
        `Your subscription payment for ${businessName || 'your account'} has been processed successfully.`,
        '',
        `Invoice Number : ${invoiceNumber}`,
        `Payment Date   : ${paidDate}`,
        `Total Paid     : ${amtStr}`,
        '',
        'Your invoice is attached as a PDF.',
        '',
        'Questions? Contact billing@icssbookings.com',
        '',
        'ICSS Booking System · https://icssbookings.com',
    ].join('\n');

    const attachments = [];
    if (pdfBuffer) {
        attachments.push({
            filename: `ICSS_Invoice_${invoiceNumber}.pdf`,
            content:  pdfBuffer.toString('base64'),
        });
    }

    await resend.emails.send({
        from:    'ICSS Billing <billing@icssbookings.com>',
        to:      [to],
        subject: `Payment Received — ICSS Booking System · ${invoiceNumber}`,
        html:    htmlBody,
        text:    textBody,
        attachments: attachments.length > 0 ? attachments : undefined,
    });

    console.log(`[Email] Subscription invoice ${invoiceNumber} sent to ${to}`);
}

async function sendPartnerAgreementEmail({ to, subject, message, pdfBuffer, link }) {
    const resend = getResend();
    if (!resend) { console.warn(`[Email] RESEND_API_KEY not set; skipped agreement email to ${to}`); return false; }
    const safe = String(message).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    await resend.emails.send({
        from: 'ICSS Contracts <contracts@icssbookings.com>', to: [to], subject,
        html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto"><h2 style="color:#7C6EF7">ICSS Partner Agreement</h2><p style="line-height:1.6">${safe}</p>${link ? `<p><a href="${link}" style="background:#7C6EF7;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none">Review agreement</a></p>` : ''}</div>`,
        text: `${message}${link ? `\n\nReview agreement: ${link}` : ''}`,
        attachments: pdfBuffer ? [{ filename: 'ICSS_Marketing_Revenue_Share_Agreement.pdf', content: pdfBuffer.toString('base64') }] : undefined
    });
    return true;
}

async function sendSupportJobStatusEmail({ to, tenantName, subject, status, note }) {
    const resend = getResend();
    if (!resend || !to) return false;
    const safe = value => escapeHtml(String(value || ''));
    await resend.emails.send({
        from: 'ICSS Developer Support <support@icssbookings.com>', to: [to],
        subject: `Issue ${status === 'completed' ? 'completed' : 'in review'} — ${subject}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto"><h2>Your support job is ${safe(status.replace('_',' '))}</h2><p><strong>${safe(subject)}</strong></p><p>${safe(note || (status === 'completed' ? 'The developer team has completed this job.' : 'The developer team is now reviewing this job.'))}</p><p style="color:#777">${safe(tenantName)} · ICSS Booking System</p></div>`,
        text: `${subject}\nStatus: ${status}\n${note || ''}`
    });
    return true;
}

module.exports = {
    getSupportContactEmail,
    sendBookingConfirmation,
    sendBookingPendingReviewEmail,
    sendBookingCancellationEmail,
    sendBookingCompletedEmail,
    sendOrderConfirmation,
    sendDesignInquiryEmail,
    sendSupportRequestEmail,
    sendPasswordResetEmail,
    sendSignupWelcomeEmail,
    sendWelcomeEmail,
    sendSubscriptionInvoiceEmail,
    sendPartnerAgreementEmail,
    sendSupportJobStatusEmail,
};
