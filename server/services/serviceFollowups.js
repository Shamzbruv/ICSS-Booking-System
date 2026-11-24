const { query } = require('../db/connection');
const { normalizeEmail, tenantReplyAddress } = require('./tenantReplyEmail');
const { ORIGIN, tenantBrand, cleanDesign, renderNewsletter } = require('./newsletterDesign');
const { sendNewsletterEmail } = require('./email');

const units = { days: 1, weeks: 7, months: 28 };
const dueDate = `(f.visit_date + CASE s.followup->>'unit'
    WHEN 'months' THEN make_interval(months => (s.followup->>'interval')::int)
    WHEN 'weeks' THEN make_interval(weeks => (s.followup->>'interval')::int)
    ELSE make_interval(days => (s.followup->>'interval')::int)
    END)::date`;
const reminderDate = `(${dueDate} - COALESCE((s.followup->>'leadDays')::int, 0))`;

function normalizeFollowup(value) {
    if (value === undefined) return null; // Existing callers can omit this field.
    if (value?.enabled === false) return { enabled: false };
    const { enabled, interval, unit, leadDays, subject, reason } = value || {};
    if (enabled !== true || !Object.hasOwn(units, unit) || !Number.isInteger(interval) || interval < 1 || interval > 365 ||
        !Number.isInteger(leadDays) || leadDays < 0 || leadDays > 90 || leadDays >= interval * units[unit] ||
        typeof reason !== 'string' || !reason.trim() || reason.trim().length > 3000 ||
        (subject !== undefined && (typeof subject !== 'string' || subject.length > 120))) {
        throw Object.assign(new Error('Enter a valid follow-up interval, an earlier reminder date, and a reason of up to 3,000 characters.'), { status: 400 });
    }
    return { enabled, interval, unit, leadDays, subject: (subject || '').trim().replace(/[\r\n]+/g, ' '), reason: reason.trim() };
}

async function enrollFollowup(client, booking) {
    const email = normalizeEmail(booking.email);
    if (!email || !booking.service_id) return;
    await client.query(`
        INSERT INTO service_followups AS f (tenant_id,service_id,email,booking_id,visit_at,visit_date)
        SELECT $1,s.id,$3,$4,COALESCE(b.start_time,b.booking_date::timestamp AT TIME ZONE 'America/Jamaica'),b.booking_date
        FROM services s JOIN bookings b ON b.id=$4 AND b.tenant_id=s.tenant_id AND b.service_id=s.id
        WHERE s.tenant_id=$1 AND s.id=$2 AND s.active AND s.followup->>'enabled'='true'
        ON CONFLICT (tenant_id,service_id,email) DO UPDATE
        SET booking_id=EXCLUDED.booking_id, visit_at=EXCLUDED.visit_at, visit_date=EXCLUDED.visit_date,
            status='scheduled', delivery_id=gen_random_uuid(), attempts=0, ready_at=NOW(),
            first_attempt_at=NULL, sent_at=NULL, message=NULL
        WHERE f.status<>'unsubscribed' AND f.booking_id<>EXCLUDED.booking_id AND
            (f.visit_at,f.booking_id)<(EXCLUDED.visit_at,EXCLUDED.booking_id)`,
    [booking.tenant_id,booking.service_id,email,booking.id]);
}

async function listFollowups(db, tenantId, serviceId, page) {
    const { rows } = await db(`
        SELECT f.email,f.status,f.visit_date::text,f.sent_at,
            CASE WHEN s.active AND s.followup->>'enabled'='true' THEN ${reminderDate}::text END AS reminder_date
        FROM service_followups f JOIN services s ON s.id=f.service_id AND s.tenant_id=f.tenant_id
        WHERE f.tenant_id=$1 AND f.service_id=$2
        ORDER BY f.visit_at DESC,f.email LIMIT 26 OFFSET $3`, [tenantId, serviceId, (page - 1) * 25]);
    return { clients: rows.slice(0,25), more: rows.length > 25 };
}

async function processFollowup(db = query, deliver = sendNewsletterEmail) {
    const { rows: [job] } = await db(`
        WITH candidate AS (
            SELECT f.delivery_id FROM service_followups f
            JOIN services s ON s.id=f.service_id AND s.tenant_id=f.tenant_id
            JOIN tenants t ON t.id=f.tenant_id
            WHERE f.status IN ('scheduled','sending') AND f.ready_at<=NOW()
              AND t.active AND s.active AND s.followup->>'enabled'='true'
              AND ${reminderDate} <= (NOW() AT TIME ZONE 'America/Jamaica')::date
            ORDER BY f.ready_at,f.delivery_id LIMIT 1 FOR UPDATE OF f SKIP LOCKED
        )
        UPDATE service_followups f SET status='sending',attempts=attempts+1,
            ready_at=NOW()+INTERVAL '5 minutes',first_attempt_at=COALESCE(first_attempt_at,NOW())
        FROM candidate WHERE f.delivery_id=candidate.delivery_id RETURNING f.*`);
    if (!job) return false;
    const finish = status => db(`
        UPDATE service_followups SET status=$2,ready_at=NOW()+INTERVAL '2 minutes'*attempts,
            sent_at=CASE WHEN $2='sent' THEN NOW() ELSE sent_at END
        WHERE delivery_id=$1 AND attempts=$3 AND status='sending'`, [job.delivery_id,status,job.attempts]);
    if (job.attempts > 5 || Date.now() - new Date(job.first_attempt_at) > 20 * 3600_000) {
        await finish('failed');
        return true;
    }

    try {
        const { rows: [data] } = await db(`
            SELECT t.id,t.slug,t.name,t.branding,t.site_config,s.name AS service_name,s.followup,
                ${dueDate}::text AS due_on,
                b.status='completed' AND LOWER(TRIM(b.email))=f.email AND b.service_id=s.id
                AND NOT EXISTS (
                    SELECT 1 FROM bookings next
                    WHERE next.tenant_id=f.tenant_id AND next.service_id=s.id AND next.id<>b.id
                      AND LOWER(TRIM(next.email))=f.email
                      AND (next.status='completed' AND (next.booking_date,next.booking_time,next.id)>(b.booking_date,b.booking_time,b.id)
                           OR next.status='confirmed' AND next.start_time>NOW())
                ) AS eligible,
                t.active AND s.active AND s.followup->>'enabled'='true' AS enabled
            FROM service_followups f JOIN services s ON s.id=f.service_id AND s.tenant_id=f.tenant_id
            JOIN tenants t ON t.id=f.tenant_id JOIN bookings b ON b.id=f.booking_id AND b.tenant_id=f.tenant_id
            WHERE f.delivery_id=$1 AND f.attempts=$2 AND f.status='sending'`, [job.delivery_id,job.attempts]);
        if (!data) return true;
        if (!data.enabled) {
            await finish('scheduled');
            return true;
        }
        if (!data.eligible) {
            await finish('skipped');
            return true;
        }
        const unsubscribe = `${ORIGIN}/api/v1/service-followups/unsubscribe/${job.token}`;
        let message = job.message;
        if (!message) {
            const brand = { ...tenantBrand(data), replyTo: await tenantReplyAddress(db, data.id) };
            const due = new Intl.DateTimeFormat('en-JM', {dateStyle:'long',timeZone:'UTC'}).format(new Date(data.due_on + 'T12:00:00Z'));
            const subject = data.followup.subject || ('Your next ' + data.service_name + ' visit').replace(/[\r\n]+/g, ' ').slice(0,140);
            const save = await db(`
                UPDATE service_followups SET message=$3 WHERE delivery_id=$1 AND attempts=$2 AND status='sending' RETURNING message`,
            [job.delivery_id,job.attempts,JSON.stringify({
                brand, subject, content: {
                    subject, heading: 'Time to plan your next visit',
                    body: `Your recommended return date for ${data.service_name} is ${due}.\n\n${data.followup.reason}`,
                    actionLabel: 'Book your next visit', actionUrl: `${brand.url}/book?service=${job.service_id}`
                }
            })]);
            message = save.rows[0]?.message;
            if (!message) return true;
        }
        const result = await deliver({
            brand: message.brand, email: job.email, subject: message.subject,
            ...renderNewsletter({ brand: message.brand, design: cleanDesign(), message: message.content, unsubscribe,
                subscriptionReason: `You received this reminder after booking with ${message.brand.name}.`, unsubscribeLabel: 'Stop these reminders' }),
            headers: { 'List-Unsubscribe': `<${unsubscribe}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
            idempotencyKey: `service-followup-${job.delivery_id}`
        });
        if (!result?.id) throw new Error('Missing provider acceptance.');
        await finish('sent');
    } catch (error) {
        console.error('[ServiceFollowups/Delivery]', error.code || error.name);
        await finish(job.attempts >= 5 ? 'failed' : 'scheduled');
    }
    return true;
}

function startServiceFollowupWorker() {
    if (!process.env.RESEND_API_KEY) return;
    const tick = async () => {
        let delay = 30_000;
        try { if (await processFollowup()) delay = 2_000; }
        catch (error) { console.error('[ServiceFollowups/Worker]', error.code || error.name); }
        setTimeout(tick, delay).unref();
    };
    setTimeout(tick, 6_000).unref();
}

module.exports = { normalizeFollowup, enrollFollowup, listFollowups, processFollowup, startServiceFollowupWorker };
