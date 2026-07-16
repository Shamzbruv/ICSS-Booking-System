const axios = require('axios');
const { query } = require('../db/connection');
const { buildCalendarLandingUrl } = require('./bookingCalendar');

function configured() {
    return Boolean(process.env.WHATSAPP_ENABLED === 'true' && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM && process.env.TWILIO_WHATSAPP_CONTENT_SID);
}

function normalizeWhatsappNumber(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const digits = raw.replace(/\D/g, '');
    if (raw.startsWith('+') && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    return null;
}

function displayDate(value) {
    const raw = value instanceof Date ? value.toISOString().slice(0, 10) : String(value || '').slice(0, 10);
    const date = new Date(`${raw}T00:00:00`);
    return Number.isNaN(date.getTime()) ? raw : date.toLocaleDateString('en-JM', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function displayTime(value) {
    const [hours, minutes] = String(value || '').slice(0, 5).split(':').map(Number);
    if (!Number.isFinite(hours)) return String(value || '');
    return `${hours % 12 || 12}:${String(minutes || 0).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
}

async function record(bookingId, status, details = {}) {
    if (!bookingId) return;
    await query(
        `UPDATE bookings SET whatsapp_status=$2, whatsapp_message_sid=COALESCE($3,whatsapp_message_sid), whatsapp_error=$4, whatsapp_sent_at=CASE WHEN $2='sent' THEN NOW() ELSE whatsapp_sent_at END WHERE id=$1`,
        [bookingId, status, details.sid || null, details.error || null]
    ).catch(err => console.error('[WhatsApp/Tracking]', err.message));
}

async function sendBookingConfirmationWhatsApp(booking, tenant) {
    if (!booking?.whatsapp_opt_in) return { skipped: 'not_opted_in' };
    if (!configured()) {
        await record(booking.id, 'not_configured');
        console.warn('[WhatsApp] Integration disabled or incomplete; confirmation was not sent.');
        return { skipped: 'not_configured' };
    }

    const to = normalizeWhatsappNumber(booking.phone);
    if (!to) {
        await record(booking.id, 'failed', { error: 'Phone number is not valid E.164 format.' });
        return { skipped: 'invalid_phone' };
    }

    const calendarUrl = buildCalendarLandingUrl(booking.id);
    if (!calendarUrl) {
        await record(booking.id, 'failed', { error: 'Calendar signing secret is not configured.' });
        return { skipped: 'calendar_not_configured' };
    }

    const variables = {
        '1': String(booking.name || 'Client').split(' ')[0],
        '2': tenant?.name || 'the business',
        '3': booking.service_name || 'Appointment',
        '4': displayDate(booking.booking_date),
        '5': displayTime(booking.booking_time),
        '6': calendarUrl
    };
    const fromNumber = normalizeWhatsappNumber(String(process.env.TWILIO_WHATSAPP_FROM).replace(/^whatsapp:/i, ''));
    if (!fromNumber) throw new Error('TWILIO_WHATSAPP_FROM must be a valid E.164 number.');

    const body = new URLSearchParams({
        To: `whatsapp:${to}`, From: `whatsapp:${fromNumber}`,
        ContentSid: process.env.TWILIO_WHATSAPP_CONTENT_SID,
        ContentVariables: JSON.stringify(variables)
    });

    try {
        const response = await axios.post(
            `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`,
            body.toString(),
            { auth: { username: process.env.TWILIO_ACCOUNT_SID, password: process.env.TWILIO_AUTH_TOKEN }, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 15000 }
        );
        await record(booking.id, 'sent', { sid: response.data.sid });
        return { sent: true, sid: response.data.sid };
    } catch (err) {
        const message = err.response?.data?.message || err.message || 'Twilio delivery request failed.';
        await record(booking.id, 'failed', { error: String(message).slice(0, 500) });
        console.error('[WhatsApp/Confirmation]', message);
        return { sent: false, error: message };
    }
}

module.exports = { sendBookingConfirmationWhatsApp, normalizeWhatsappNumber };
