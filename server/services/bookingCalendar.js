const crypto = require('crypto');

function calendarSecret() {
    return process.env.CALENDAR_LINK_SECRET || process.env.JWT_SECRET || '';
}

function createCalendarToken(bookingId) {
    if (!bookingId || !calendarSecret()) return null;
    return crypto.createHmac('sha256', calendarSecret()).update(String(bookingId)).digest('hex');
}

function verifyCalendarToken(bookingId, token) {
    const expected = createCalendarToken(bookingId);
    if (!expected || !token || expected.length !== String(token).length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(token)));
}

function publicBaseUrl() {
    return String(process.env.PUBLIC_APP_URL || process.env.BASE_URL || 'https://icssbookings.com').replace(/\/+$/, '');
}

function buildCalendarLandingUrl(bookingId) {
    const token = createCalendarToken(bookingId);
    return token ? `${publicBaseUrl()}/api/v1/calendar/booking/${bookingId}/view?token=${token}` : null;
}

function dateOnly(value) {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value || '').slice(0, 10);
}

function timeOnly(value) {
    return String(value || '').slice(0, 5);
}

function utcStamp(value) {
    return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function escapeIcs(value) {
    return String(value || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function calendarDetails(booking) {
    const start = booking.start_time ? new Date(booking.start_time) : new Date(`${dateOnly(booking.booking_date)}T${timeOnly(booking.booking_time)}:00-05:00`);
    const fallbackMinutes = Math.max(30, Number(booking.duration_minutes || 60));
    const end = booking.end_time ? new Date(booking.end_time) : new Date(start.getTime() + fallbackMinutes * 60000);
    const business = booking.tenant_name || 'Your service provider';
    const service = booking.service_name || 'Appointment';
    const summary = `${service} @ ${business}`;
    const description = `Confirmed booking with ${business}. Service: ${service}.`;
    const location = booking.region || booking.tenant_location || business;
    return { start, end, business, service, summary, description, location };
}

function buildGoogleCalendarUrl(booking) {
    const item = calendarDetails(booking);
    const params = new URLSearchParams({
        action: 'TEMPLATE', text: item.summary,
        dates: `${utcStamp(item.start)}/${utcStamp(item.end)}`,
        details: item.description, location: item.location
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function buildIcs(booking) {
    const item = calendarDetails(booking);
    return [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ICSS Booking System//EN',
        'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
        `UID:${booking.id}@icssbookings.com`, `DTSTAMP:${utcStamp(new Date())}`,
        `DTSTART:${utcStamp(item.start)}`, `DTEND:${utcStamp(item.end)}`,
        `SUMMARY:${escapeIcs(item.summary)}`, `DESCRIPTION:${escapeIcs(item.description)}`,
        `LOCATION:${escapeIcs(item.location)}`, 'STATUS:CONFIRMED',
        'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');
}

module.exports = { buildCalendarLandingUrl, verifyCalendarToken, buildGoogleCalendarUrl, buildIcs, calendarDetails };
