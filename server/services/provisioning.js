/**
 * Platform Provisioning Service
 *
 * Handles asynchronous, idempotent tenant creation and theme seeding.
 */

const { query, transaction } = require('../db/connection');
const { normalizeInternalSignupPlanId, isConfiguredTrialPlan } = require('./paypalConfig');
const RESERVED_SLUGS = new Set([
    'admin', 'api', 'login', 'signup', 'dashboard', 'settings', 'www', 'app',
    'auth', 'billing', 'support', 'help', 'docs', 'blog', 'static', 'assets'
]);

function slugifyBusinessName(name) {
    let slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
        
    if (!slug || slug.length < 2) slug = 'tenant';
    if (RESERVED_SLUGS.has(slug)) slug = `${slug}-app`;
    return slug;
}

/**
 * Ensures services are only seeded on the FIRST provision or explicitly requested.
 */
async function seedStarterServices(tenantId, themeId, db = { query }) {
    if (!themeId) return;
        const themeResult = await db.query(`SELECT business_config FROM themes WHERE id = $1`, [themeId]);
        if (themeResult.rows.length === 0) return;

        const config = themeResult.rows[0].business_config || {};
        const services = config.services || [];

        // Check if tenant already has services seeded to prevent duplication
        const existingServicesResult = await db.query(`SELECT COUNT(*) as count FROM services WHERE tenant_id = $1`, [tenantId]);
        if (parseInt(existingServicesResult.rows[0].count, 10) > 0) {
            console.log(`[Provisioning] Tenant ${tenantId} already has services. Skipping seed.`);
            return;
        }

        // Only seed if no services exist
        for (const s of services) {
            await db.query(
                `INSERT INTO services (tenant_id, name, description, duration_minutes, price, currency)
                 VALUES ($1, $2, $3, $4, $5, 'JMD')`,
                [tenantId, s.name, s.description || 'Starter service', s.duration_minutes || 30, s.price || 0]
            );
        }
        console.log(`[Provisioning] Seeded ${services.length} starter services for tenant ${tenantId}.`);
}

/**
 * Idempotent Provisioning Job.
 * Takes a pg-boss job object containing a `jobId` representing a `provisioning_jobs` row.
 */
async function processProvisioningJob(job) {
    const jobId = job?.data?.jobId;
    if (!jobId) throw new Error('provisioning-jobs payload is missing jobId.');
    let completedSignup = null;
    try {
        completedSignup = await transaction(async client => {
            const jobRes = await client.query(`SELECT * FROM provisioning_jobs WHERE id=$1 FOR UPDATE`, [jobId]);
            if (!jobRes.rows.length) throw new Error('Provisioning job not found.');
            const storedJob = jobRes.rows[0];
            if (storedJob.status === 'completed') return null;
            if (!storedJob.signup_token) throw new Error('Provisioning job has no signup token.');
            const pendingRes = await client.query(`SELECT * FROM pending_signups WHERE signup_token=$1 FOR UPDATE`, [storedJob.signup_token]);
            if (!pendingRes.rows.length) throw new Error('Pending signup not found.');
            const signup = pendingRes.rows[0];
            if (signup.status === 'provisioned') {
                await client.query(`UPDATE provisioning_jobs SET status='completed',updated_at=NOW() WHERE id=$1`, [jobId]);
                return null;
            }
            if (!['payment_verified','provisioning'].includes(signup.status) || !signup.payment_verified_at || !signup.paypal_subscription_id) {
                throw new Error('Signup payment has not been verified.');
            }
            await client.query(`UPDATE pending_signups SET status='provisioning' WHERE id=$1`, [signup.id]);
            await client.query(`UPDATE provisioning_jobs SET status='processing',attempts=attempts+1,error_message=NULL,updated_at=NOW() WHERE id=$1`, [jobId]);

            const payload = storedJob.payload || {};
            const paypalSubId = signup.paypal_subscription_id;
            const paypalPlanId = payload.paypal_plan_id || payload.plan_id || null;
            const planId = normalizeInternalSignupPlanId(signup.plan_id);
            const initialSubscriptionStatus = isConfiguredTrialPlan(paypalPlanId) ? 'trial' : 'paid';
            let finalSlug = slugifyBusinessName(signup.tenant_name);
            let tenant = null;
            for (let suffix = 1; suffix <= 10 && !tenant; suffix++) {
                try {
                    const tenantResult = await client.query(
                    `INSERT INTO tenants (slug, name, plan_id, theme_id, paypal_subscription_id, paypal_plan_id, subscription_status)
                     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                    [finalSlug, signup.tenant_name, planId, signup.theme_id, paypalSubId, paypalPlanId, initialSubscriptionStatus]
                    );
                    tenant = tenantResult.rows[0];
                } catch (err) {
                    if (err.code !== '23505' || err.constraint !== 'tenants_slug_key') throw err;
                    finalSlug = `${slugifyBusinessName(signup.tenant_name)}-${suffix + 1}`;
                }
            }
            if (!tenant) throw new Error('Failed to generate a unique tenant slug.');
            await client.query(
            `INSERT INTO users (tenant_id, email, password_hash, name, role)
             VALUES ($1, $2, $3, $4, 'tenant_admin')`,
            [tenant.id, signup.admin_email.toLowerCase().trim(), signup.admin_password_hash, signup.admin_owner_name || signup.admin_email]
            );
            await seedStarterServices(tenant.id, signup.theme_id, client);
            await client.query(`UPDATE provisioning_jobs SET status='completed',updated_at=NOW() WHERE id=$1`, [jobId]);
            await client.query(`UPDATE pending_signups SET status='provisioned',tenant_slug=$1 WHERE id=$2`, [finalSlug,signup.id]);
            const firstName = (signup.admin_owner_name || signup.admin_email).split(' ')[0];
            const outbox = await client.query(
                `INSERT INTO email_outbox(message_type,dedupe_key,recipient,payload) VALUES('platform_ready',$1,$2,$3)
                 ON CONFLICT(dedupe_key) DO UPDATE SET updated_at=NOW() RETURNING id`,
                [`platform_ready:${signup.signup_token}`,signup.admin_email,JSON.stringify({ firstName,tenantName:signup.tenant_name,tenantSlug:finalSlug })]
            );
            return { ...signup, tenant_slug:finalSlug, email_outbox_id:outbox.rows[0].id };
        });

        if (!completedSignup) return;
        try {
            const { enqueue } = require('./queue');
            await enqueue('email-outbox', { outboxId:completedSignup.email_outbox_id });
        } catch (emailErr) {
            console.error('[Provisioning] Ready email remains pending in outbox:', emailErr.message);
        }
        console.log(`[Provisioning] Successfully completed provisioning for tenant ${completedSignup.tenant_slug}.`);
    } catch (err) {
        console.error(`[Provisioning Error Job ${jobId}]:`, err.message);
        await query(
            `UPDATE provisioning_jobs SET status='failed',error_message=$1,updated_at=NOW() WHERE id=$2`,
            [err.message, jobId]
        );
        throw err;
    }
}

/**
 * Enqueue job — inserts into database queue and triggers immediate processing.
 */
async function enqueueProvisioningJob(tenantSlug, signupToken, webhookId, payload) {
    try {
        const result = await query(
            `INSERT INTO provisioning_jobs (tenant_slug, signup_token, webhook_id, payload) 
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (signup_token) WHERE signup_token IS NOT NULL DO UPDATE SET webhook_id=COALESCE(EXCLUDED.webhook_id,provisioning_jobs.webhook_id),payload=EXCLUDED.payload,updated_at=NOW()
             RETURNING id`,
            [tenantSlug, signupToken, webhookId, JSON.stringify(payload)]
        );
        
        // Trigger background processing durably through pg-boss
        const { enqueue } = require('./queue');
        await enqueue('provisioning-jobs', { jobId: result.rows[0].id });

    } catch (e) {
        console.error('[Provisioning Enqueue Error]', e);
        // Surface the failure to the caller (PayPal webhook handler) so it returns 500
        // and PayPal will retry the delivery automatically.
        throw e;
    }
}

module.exports = { enqueueProvisioningJob, seedStarterServices, processProvisioningJob };
