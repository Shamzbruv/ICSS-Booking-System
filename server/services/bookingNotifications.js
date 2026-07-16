const { sendBookingConfirmation } = require('./email');
const { sendBookingConfirmationWhatsApp } = require('./whatsapp');

async function sendBookingConfirmationNotifications(booking, tenant) {
    const results = await Promise.allSettled([
        sendBookingConfirmation(booking, tenant),
        sendBookingConfirmationWhatsApp(booking, tenant)
    ]);
    results.forEach((result, index) => {
        if (result.status === 'rejected') console.error(`[BookingNotification/${index === 0 ? 'Email' : 'WhatsApp'}]`, result.reason?.message || result.reason);
    });
    return results;
}

module.exports = { sendBookingConfirmationNotifications };
