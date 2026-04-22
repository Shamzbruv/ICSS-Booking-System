/**
 * Booking Worker
 * Handles background jobs related to booking lifecycles.
 */

const { query } = require('../db/connection');

/**
 * Idempotent job to expire temporary holds on unpaid bookings.
 */
async function processExpireBookingHold(job) {
    const { bookingId } = job.data;

    try {
        console.log(`[Queue] Checking expiration for booking: ${bookingId}`);

        // Fetch the booking
        const result = await query(`SELECT status, payment_mode FROM bookings WHERE id = $1`, [bookingId]);
        if (result.rows.length === 0) return; // Booking was deleted

        const booking = result.rows[0];

        // Idempotency check: Only expire if still in a pending hold state
        if (booking.status !== 'pending_payment' && booking.status !== 'pending_manual_confirmation') {
            console.log(`[Queue] Booking ${bookingId} is already '${booking.status}'. No expiration needed.`);
            return;
        }

        // Expire the booking to release the slot
        await query(`UPDATE bookings SET status = 'expired', updated_at = NOW() WHERE id = $1`, [bookingId]);
        
        // Mark payment record as failed/expired
        await query(`UPDATE booking_payments SET status = 'failed' WHERE booking_id = $1 AND status = 'pending'`, [bookingId]);

        console.log(`[Queue] ⚠️ Booking ${bookingId} has been automatically EXPIRED.`);

    } catch (err) {
        console.error(`[Queue] Error processing expire-booking-hold for ${bookingId}:`, err.message);
        throw err; // Let pg-boss retry or fail
    }
}

module.exports = {
    processExpireBookingHold
};
