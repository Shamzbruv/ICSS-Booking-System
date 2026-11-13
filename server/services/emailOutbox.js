const { query } = require('../db/connection');
const { sendSignupWelcomeEmail, sendWelcomeEmail, sendBookingCompletedEmail, sendConsultationEmail, sendConsultationRequestEmail } = require('./email');

async function saveEmailOutbox({ messageType, dedupeKey, recipient, payload }, client) {
    const result = await client.query(
        `INSERT INTO email_outbox(message_type,dedupe_key,recipient,payload) VALUES($1,$2,$3,$4)
         ON CONFLICT(dedupe_key) DO UPDATE SET
           status=CASE WHEN email_outbox.status='cancelled' THEN 'pending' ELSE email_outbox.status END,
           recipient=CASE WHEN email_outbox.status='cancelled' THEN EXCLUDED.recipient ELSE email_outbox.recipient END
         RETURNING id,status`,
        [messageType,dedupeKey,recipient,JSON.stringify(payload || {})]
    );
    return result.rows[0];
}

async function dispatchEmailOutbox(outboxId) {
    const { enqueue } = require('./queue');
    const jobId = await enqueue('email-outbox', { outboxId });
    if (!jobId) throw new Error('The email queue did not accept the job.');
}

async function enqueueEmailOutbox(email) {
    const row = await saveEmailOutbox(email, { query });
    if (row.status !== 'sent') await dispatchEmailOutbox(row.id);
    return row;
}

async function saveBookingReviewEmail(client, booking) {
    const recipient = String(booking.email || '').trim();
    if (!recipient) return null;
    return saveEmailOutbox({
        messageType: 'booking_completed',
        dedupeKey: `booking_completed:${booking.id}`,
        recipient,
        payload: { bookingId: booking.id, tenantId: booking.tenant_id }
    }, client);
}

async function processEmailOutbox(job) {
    const outboxId = job?.data?.outboxId;
    if (!outboxId) throw new Error('email-outbox job is missing outboxId.');
    const claimed = await query(
        `UPDATE email_outbox SET status='sending',attempts=attempts+1,updated_at=NOW()
         WHERE id=$1 AND next_attempt_at<=NOW()
           AND (status IN ('pending','failed') OR (status='sending' AND updated_at < NOW() - INTERVAL '15 minutes'))
         RETURNING *`, [outboxId]
    );
    if (!claimed.rows.length) return;
    const row = claimed.rows[0], payload = row.payload || {};
    try {
        let providerResult;
        if (row.message_type === 'signup_received') {
            providerResult = await sendSignupWelcomeEmail(row.recipient,payload.firstName,payload.tenantName,payload.options || {});
        } else if (row.message_type === 'platform_ready') {
            providerResult = await sendWelcomeEmail(row.recipient,payload.firstName,payload.tenantName,{ tenantSlug:payload.tenantSlug });
        } else if (row.message_type === 'booking_completed') {
            const [bookings, tenants] = await Promise.all([
                query('SELECT * FROM bookings WHERE id=$1 AND tenant_id=$2', [payload.bookingId, payload.tenantId]),
                query('SELECT id,slug,name,branding FROM tenants WHERE id=$1', [payload.tenantId])
            ]);
            const booking = bookings.rows[0];
            const tenant = tenants.rows[0];
            if (!tenant || booking?.status !== 'completed' || String(booking.email || '').trim() !== row.recipient) {
                await query("UPDATE email_outbox SET status='cancelled',updated_at=NOW() WHERE id=$1", [row.id]);
                return;
            }
            providerResult = await sendBookingCompletedEmail(booking, tenant, { idempotencyKey: row.dedupe_key });
            if (!providerResult?.id) throw new Error('The email provider did not confirm acceptance.');
        } else if (['consultation', 'consultation_request'].includes(row.message_type)) {
            const { rows: [booking] } = await query('SELECT * FROM consultations WHERE id=$1', [payload.id]);
            if (!booking || booking.version !== payload.version) {
                await query("UPDATE email_outbox SET status='cancelled',updated_at=NOW() WHERE id=$1", [row.id]);
                return;
            }
            providerResult = row.message_type === 'consultation_request'
                ? await sendConsultationRequestEmail(booking, row.recipient, row.dedupe_key)
                : await sendConsultationEmail(booking, row.dedupe_key, payload.action);
            if (!providerResult?.id) throw new Error('The email provider did not confirm acceptance.');
        } else throw new Error(`Unsupported outbox message type: ${row.message_type}`);
        await query(`UPDATE email_outbox SET status='sent',sent_at=NOW(),provider_message_id=$2,last_error=NULL,updated_at=NOW() WHERE id=$1`, [row.id,providerResult?.id || null]);
    } catch (err) {
        await query(`UPDATE email_outbox SET status='failed',last_error=$2,next_attempt_at=NOW(),updated_at=NOW() WHERE id=$1`, [row.id,String(err.message).slice(0,1000)]);
        throw err;
    }
}

module.exports = { saveEmailOutbox, enqueueEmailOutbox, processEmailOutbox, dispatchEmailOutbox, saveBookingReviewEmail };
