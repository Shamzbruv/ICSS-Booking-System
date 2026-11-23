const { tenantReplyAddress } = require('./tenantReplyEmail');
const { query } = require('../db/connection');
const { sendNewsletterEmail } = require('./email');
const { ORIGIN, escape, cleanDesign, tenantBrand, renderNewsletter } = require('./newsletterDesign');

async function requestSubscription(db, tenant, email, deliver = sendNewsletterEmail) {
    const { rows: [subscriber] } = await db(`
        INSERT INTO newsletter_subscribers (tenant_id,email,status)
        SELECT $1,$2,'pending' WHERE EXISTS (
            SELECT 1 FROM newsletter_settings WHERE tenant_id=$1 AND enabled
        )
        ON CONFLICT (tenant_id,email) DO UPDATE SET
            status='pending', requested_at=NOW(), confirm_token=gen_random_uuid(),
            unsubscribe_token=gen_random_uuid(), subscribed_at=NULL
        WHERE newsletter_subscribers.status='unsubscribed'
           OR (newsletter_subscribers.status='pending' AND newsletter_subscribers.requested_at < NOW() - INTERVAL '1 hour')
        RETURNING confirm_token`, [tenant.id, email]);
    if (!subscriber) return;

    const brand = { ...tenantBrand(tenant), replyTo: await tenantReplyAddress(db, tenant.id) };
    const url = `${ORIGIN}/api/v1/newsletter/confirm/${subscriber.confirm_token}`;
    const subject = `Confirm your subscription to ${brand.name}`.replace(/[\r\n]+/g, ' ');
    const content = renderNewsletter({
        brand, design: cleanDesign(),
        message: { subject, body: 'Confirm that you want to receive news and updates. If you didn’t request this, you can ignore this email.', actionLabel: 'Confirm subscription', actionUrl: url }
    });
    try {
        const sent = await deliver({ brand, email, subject, ...content, idempotencyKey: `newsletter-confirm-${subscriber.confirm_token}` });
        if (!sent?.id) throw new Error('Missing provider acceptance.');
    } catch (error) {
        await db(`UPDATE newsletter_subscribers SET requested_at=NOW() - INTERVAL '1 hour 1 minute'
                  WHERE tenant_id=$1 AND confirm_token=$2 AND status='pending'`, [tenant.id, subscriber.confirm_token]);
        throw error;
    }
}

async function confirmSubscription(db, token) {
    const result = await db(`
        UPDATE newsletter_subscribers AS subscriber
        SET status='subscribed', subscribed_at=COALESCE(subscribed_at,NOW()), unsubscribed_at=NULL
        FROM tenants, newsletter_settings AS settings
        WHERE subscriber.confirm_token=$1 AND tenants.id=subscriber.tenant_id AND tenants.active
          AND settings.tenant_id=tenants.id AND settings.enabled
          AND (subscriber.status='subscribed' OR (subscriber.status='pending' AND subscriber.requested_at > NOW() - INTERVAL '2 days'))
        RETURNING subscriber.id`, [token]);
    return Boolean(result.rows.length);
}

async function unsubscribe(db, token) {
    await db(`UPDATE newsletter_subscribers SET status='unsubscribed', unsubscribed_at=NOW(), confirm_token=gen_random_uuid()
              WHERE unsubscribe_token=$1 AND status <> 'unsubscribed'`, [token]);
}

async function queueCampaign(client, tenantId, requestId, subscriberId, content) {
    const { rows: [campaign] } = await client.query(`
        INSERT INTO newsletter_campaigns (tenant_id, request_id, subject, message)
        VALUES ($1,$2,$3,$4) ON CONFLICT (tenant_id,request_id) DO NOTHING RETURNING id`,
    [tenantId, requestId, content.message.subject, JSON.stringify(content)]);
    if (!campaign) {
        const { rows: [existing] } = await client.query(
            'SELECT id FROM newsletter_campaigns WHERE tenant_id=$1 AND request_id=$2', [tenantId, requestId]);
        return { id: existing.id };
    }

    const result = await client.query(`
        INSERT INTO newsletter_deliveries (tenant_id,campaign_id,subscriber_id)
        SELECT tenant_id,$2,id FROM newsletter_subscribers
        WHERE tenant_id=$1 AND status='subscribed' AND ($3::uuid IS NULL OR id=$3)
        ORDER BY id`, [tenantId, campaign.id, subscriberId]);
    if (!result.rowCount && !result.affectedRows) {
        throw Object.assign(new Error(subscriberId ? 'This subscriber is no longer subscribed.' : 'There are no confirmed subscribers yet.'), { status: 409 });
    }
    return { id: campaign.id, recipients: result.rowCount ?? result.affectedRows };
}

async function processDelivery(db = query, deliver = sendNewsletterEmail) {
    const { rows: [job] } = await db(`
        WITH candidate AS (
            SELECT id FROM newsletter_deliveries WHERE status IN ('queued','sending') AND ready_at <= NOW()
            ORDER BY ready_at,id LIMIT 1 FOR UPDATE SKIP LOCKED
        )
        UPDATE newsletter_deliveries AS delivery SET status='sending', attempts=attempts+1,
            ready_at=NOW() + INTERVAL '3 minutes', first_attempt_at=COALESCE(first_attempt_at,NOW())
        FROM candidate WHERE delivery.id=candidate.id
        RETURNING delivery.*`);
    if (!job) return false;
    const finish = (status, providerId = null) => db(`
        UPDATE newsletter_deliveries SET status=$2, provider_message_id=$3,
           ready_at=NOW() + INTERVAL '45 seconds' * attempts
        WHERE id=$1 AND attempts=$4 AND status='sending'`, [job.id, status, providerId, job.attempts]);

    if (job.attempts > 5 || Date.now() - new Date(job.first_attempt_at) > 20 * 3600 * 1000) {
        await finish('failed');
        return true;
    }
    try {
        // Recheck consent against the campaign snapshot before each delivery or retry.
        const { rows: [recipient] } = await db(`
            SELECT subscriber.email, subscriber.unsubscribe_token, campaign.message
            FROM newsletter_subscribers AS subscriber
            JOIN tenants ON tenants.id=subscriber.tenant_id AND tenants.active
            JOIN newsletter_campaigns AS campaign ON campaign.id=$1 AND campaign.tenant_id=tenants.id
            WHERE subscriber.tenant_id=$2 AND subscriber.id=$3 AND subscriber.status='subscribed'
              AND subscriber.subscribed_at <= campaign.created_at`, [job.campaign_id, job.tenant_id, job.subscriber_id]);
        if (!recipient) {
            await finish('skipped');
            return true;
        }
        const content = recipient.message;
        const url = `${ORIGIN}/api/v1/newsletter/unsubscribe/${recipient.unsubscribe_token}`;
        const result = await deliver({
            brand: content.brand, email: recipient.email, subject: content.message.subject,
            ...renderNewsletter({ ...content, unsubscribe: url }),
            headers: { 'List-Unsubscribe': `<${url}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
            idempotencyKey: `newsletter-delivery-${job.id}`
        });
        if (!result?.id) throw new Error('Missing provider acceptance.');
        await finish('sent', result.id);
    } catch (error) {
        await finish(job.attempts >= 5 ? 'failed' : 'queued');
    }
    return true;
}

function startNewsletterWorker() {
    if (!process.env.RESEND_API_KEY) return;
    const tick = async () => {
        let delay = 4000;
        try {
            if (await processDelivery()) delay = 1100;
        } catch (error) {
            console.error('[Newsletter/Worker]', error.code || error.name);
        } finally {
            setTimeout(tick, delay).unref();
        }
    };
    setTimeout(tick, 2000).unref();
}

function subscriptionPage({ title, message, action, label }) {
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)}</title>
      <style>body{font:16px/1.55 system-ui,sans-serif;background:#f5f5fb;color:#182335;margin:0;padding:48px 20px}main{max-width:510px;margin:auto;background:white;padding:30px;border:1px solid #deddec;border-radius:14px}h1{margin:0 0 12px;font-size:1.65rem}button{padding:11px 18px;background:#5946b1;color:white;border:0;border-radius:7px;font:inherit;cursor:pointer}</style></head>
      <body><main><h1>${escape(title)}</h1><p>${escape(message)}</p>
      ${action ? `<form method="post" action="${escape(action)}"><button type="submit">${escape(label)}</button></form>` : ''}</main></body></html>`;
}

module.exports = { requestSubscription, confirmSubscription, unsubscribe, queueCampaign, processDelivery, startNewsletterWorker, subscriptionPage };
