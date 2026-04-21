/**
 * SaaS Provisioning Service
 *
 * Handles asynchronous, idempotent tenant creation and theme seeding.
 */

const { query } = require('../db/connection');
const bcrypt = require('bcryptjs');

function slugifyBusinessName(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * Ensures services are only seeded on the FIRST provision or explicitly requested.
 */
async function seedStarterServices(tenantId, themeId) {
    if (!themeId) return;

    try {
        const themeResult = await query(`SELECT business_config FROM themes WHERE id = $1`, [themeId]);
        if (themeResult.rows.length === 0) return;

        const config = themeResult.rows[0].business_config || {};
        const services = config.services || [];

        // Check if tenant already has services seeded to prevent duplication
        const existingServicesResult = await query(`SELECT COUNT(*) as count FROM services WHERE tenant_id = $1`, [tenantId]);
        if (parseInt(existingServicesResult.rows[0].count, 10) > 0) {
            console.log(`[Provisioning] Tenant ${tenantId} already has services. Skipping seed.`);
            return;
        }

        // Only seed if no services exist
        for (const s of services) {
            await query(
                `INSERT INTO services (tenant_id, name, description, duration_minutes, price, currency)
                 VALUES ($1, $2, $3, $4, $5, 'JMD')`,
                [tenantId, s.name, s.description || 'Starter service', s.duration_minutes || 30, s.price || 0]
            );
        }
        console.log(`[Provisioning] Seeded ${services.length} starter services for tenant ${tenantId}.`);
    } catch (e) {
        console.error('[Provisioning/Seed Error]', e);
    }
}

/**
 * Idempotent Provisioning Job.
 * Takes a UUID representing a `provisioning_jobs` row and executes it.
 */
async function processProvisioningJob(jobId) {
    try {
        const jobRes = await query(`SELECT * FROM provisioning_jobs WHERE id = $1`, [jobId]);
        if (jobRes.rows.length === 0) return;
        const job = jobRes.rows[0];

        if (job.status === 'completed') return;

        // 1. Fetch pending signup data based on token
        const signupToken = job.signup_token;
        if (!signupToken) throw new Error('Missing signup_token in provisioning job');

        const pendingRes = await query(`SELECT * FROM pending_signups WHERE signup_token = $1`, [signupToken]);
        if (pendingRes.rows.length === 0) throw new Error(`Pending signup not found for token: ${signupToken}`);

        const signup = pendingRes.rows[0];
        // Generate unique slug
        let baseSlug = slugifyBusinessName(signup.tenant_name);
        if (!baseSlug) baseSlug = 'tenant';
        
        let finalSlug = baseSlug;
        let slugCounter = 1;
        let isUnique = false;

        while (!isUnique) {
            const existingTenant = await query(
                `SELECT id FROM tenants WHERE slug = $1`,
                [finalSlug]
            );
            
            if (existingTenant.rows.length === 0) {
                isUnique = true;
            } else {
                slugCounter++;
                finalSlug = `${baseSlug}-${slugCounter}`;
            }
        }

        const payload = job.payload || {};
        const paypalSubId = payload.paypal_subscription_id || null;
        const paypalPlanId = payload.paypal_plan_id || null;
        const planId = signup.plan_id || 'starter';

        // 1. Create tenant
        const tenantResult = await query(
            `INSERT INTO tenants (slug, name, plan_id, theme_id, paypal_subscription_id, paypal_plan_id, subscription_status)
             VALUES ($1, $2, $3, $4, $5, $6, 'paid') RETURNING *`,
            [finalSlug, signup.tenant_name, planId, signup.theme_id, paypalSubId, paypalPlanId]
        );
        const tenant = tenantResult.rows[0];

        // 2. Create tenant admin user using stored hash, NO raw passwords floating around!
        await query(
            `INSERT INTO users (tenant_id, email, password_hash, name, role)
             VALUES ($1, $2, $3, $4, 'tenant_admin')`,
            [tenant.id, signup.admin_email.toLowerCase().trim(), signup.admin_password_hash, signup.admin_email]
        );

        // 3. Seed starter services asynchronously based on the theme
        await seedStarterServices(tenant.id, signup.theme_id);

        // 4. Mark job and signup as completed
        await query(`UPDATE provisioning_jobs SET status = 'completed', updated_at = NOW() WHERE id = $1`, [jobId]);
        await query(`UPDATE pending_signups SET status = 'provisioned' WHERE id = $1`, [signup.id]);

        console.log(`[Provisioning] Successfully completed provisioning for tenant ${finalSlug}.`);

    } catch (err) {
        console.error(`[Provisioning Error Job ${jobId}]:`, err.message);
        await query(
            `UPDATE provisioning_jobs SET status = 'failed', error_message = $1, attempts = attempts + 1, updated_at = NOW() WHERE id = $2`, 
            [err.message, jobId]
        );
    }
}

/**
 * Enqueue job — inserts into database queue and triggers immediate processing.
 */
async function enqueueProvisioningJob(tenantSlug, signupToken, webhookId, payload) {
    try {
        const result = await query(
            `INSERT INTO provisioning_jobs (tenant_slug, signup_token, webhook_id, payload) 
             VALUES ($1, $2, $3, $4) RETURNING id`,
            [tenantSlug, signupToken, webhookId, JSON.stringify(payload)]
        );
        
        // Trigger background processing asynchronously
        setImmediate(() => {
            processProvisioningJob(result.rows[0].id);
        });

    } catch (e) {
        console.error('[Provisioning Enqueue Error]', e);
    }
}

module.exports = { enqueueProvisioningJob, seedStarterServices };
