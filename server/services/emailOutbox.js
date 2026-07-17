const { query } = require('../db/connection');
const { sendSignupWelcomeEmail, sendWelcomeEmail } = require('./email');

async function enqueueEmailOutbox({ messageType, dedupeKey, recipient, payload }) {
    const result = await query(
        `INSERT INTO email_outbox(message_type,dedupe_key,recipient,payload) VALUES($1,$2,$3,$4)
         ON CONFLICT(dedupe_key) DO UPDATE SET updated_at=NOW() RETURNING id,status`,
        [messageType,dedupeKey,recipient,JSON.stringify(payload || {})]
    );
    if (result.rows[0].status !== 'sent') {
        const { enqueue } = require('./queue');
        await enqueue('email-outbox', { outboxId:result.rows[0].id });
    }
    return result.rows[0];
}

async function processEmailOutbox(job) {
    const outboxId = job?.data?.outboxId;
    if (!outboxId) throw new Error('email-outbox job is missing outboxId.');
    const claimed = await query(
        `UPDATE email_outbox SET status='sending',attempts=attempts+1,updated_at=NOW()
         WHERE id=$1 AND status<>'sent' AND next_attempt_at<=NOW() RETURNING *`, [outboxId]
    );
    if (!claimed.rows.length) return;
    const row = claimed.rows[0], payload = row.payload || {};
    try {
        let providerResult;
        if (row.message_type === 'signup_received') {
            providerResult = await sendSignupWelcomeEmail(row.recipient,payload.firstName,payload.tenantName,payload.options || {});
        } else if (row.message_type === 'platform_ready') {
            providerResult = await sendWelcomeEmail(row.recipient,payload.firstName,payload.tenantName,{ tenantSlug:payload.tenantSlug });
        } else throw new Error(`Unsupported outbox message type: ${row.message_type}`);
        await query(`UPDATE email_outbox SET status='sent',sent_at=NOW(),provider_message_id=$2,last_error=NULL,updated_at=NOW() WHERE id=$1`, [row.id,providerResult?.id || null]);
    } catch (err) {
        await query(`UPDATE email_outbox SET status='failed',last_error=$2,next_attempt_at=NOW(),updated_at=NOW() WHERE id=$1`, [row.id,String(err.message).slice(0,1000)]);
        throw err;
    }
}

module.exports = { enqueueEmailOutbox, processEmailOutbox };
