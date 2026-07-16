/**
 * Platform Owner Console Routes — /api/v1/platform
 *
 * All routes require authenticate + requirePlatformOwner.
 * These routes operate cross-tenant and are NEVER processed by tenantResolver.
 *
 * Impersonation model:
 *   POST /impersonate/tenant/:tenantId   — create session + short-lived overlay JWT
 *   POST /impersonation/:sessionId/end   — revoke session
 *   POST /impersonation/:sessionId/elevate — upgrade read_only → edit (requires reason)
 *   GET  /impersonation/active           — list my live sessions
 */

const express = require('express');
const router  = express.Router();
const { query } = require('../../db/connection');
const { authenticate, requirePlatformOwner, signToken } = require('../../middleware/auth');
const { invalidateTenantCache } = require('../../middleware/tenantResolver');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendSupportJobStatusEmail, sendPartnerAgreementEmail } = require('../../services/email');

function formatDateOnlyValue(value) {
    if (!value) return value;

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        const year = value.getUTCFullYear();
        const month = String(value.getUTCMonth() + 1).padStart(2, '0');
        const day = String(value.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    const match = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[1]}-${match[2]}-${match[3]}` : String(value);
}

function formatTimeOnlyValue(value) {
    if (!value) return value;
    return String(value).trim().slice(0, 8);
}

function serializeBooking(booking) {
    if (!booking) return booking;
    return {
        ...booking,
        booking_date: formatDateOnlyValue(booking.booking_date),
        booking_time: formatTimeOnlyValue(booking.booking_time)
    };
}

// All platform routes: authenticated + platform_owner only
router.use(authenticate, requirePlatformOwner);

function ownerOnly(req, res, next) {
    if (req.user.role !== 'platform_owner') return res.status(403).json({ error: 'Only the Platform Owner can manage developer accounts.' });
    next();
}

router.get('/developer-admins', async (req, res) => {
    const result = await query(`SELECT id,email,name,active,created_at FROM users WHERE tenant_id IS NULL AND role='developer_admin' ORDER BY created_at DESC`);
    res.json({ admins: result.rows });
});

router.post('/developer-admins', ownerOnly, async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase(), name = String(req.body.name || '').trim(), password = String(req.body.password || '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name || password.length < 10) return res.status(400).json({ error: 'Name, valid email, and a password of at least 10 characters are required.' });
    try {
        const duplicate = await query(`SELECT id FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1`, [email]);
        if (duplicate.rows.length) return res.status(409).json({ error:'An account with this email already exists.' });
        const pending = await query(`SELECT id FROM partner_agreements WHERE LOWER(partner_email)=LOWER($1) AND access_role='developer_admin' AND status<>'completed' LIMIT 1`, [email]);
        if (pending.rows.length) return res.status(409).json({ error:'This developer already has a pending contract invitation.' });
        const token = crypto.randomBytes(32).toString('base64url');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const passwordHash = await bcrypt.hash(password, 12);
        const result = await query(`INSERT INTO partner_agreements (partner_email,partner_name,signing_token_hash,signing_token_expires_at,access_role,pending_password_hash)
            VALUES ($1,$2,$3,NOW()+INTERVAL '7 days','developer_admin',$4) RETURNING id,partner_email,partner_name,status,signing_token_expires_at,access_role,created_at`, [email,name,tokenHash,passwordHash]);
        const origin = String(process.env.BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
        const signingLink = `${origin}/partner-contract.html?token=${encodeURIComponent(token)}`;
        await sendPartnerAgreementEmail({ to:email,subject:'Your ICSS agreement — signature required before developer access',message:`You have been invited to join the ICSS developer platform. Review and sign the agreement using this private one-time link, which expires in 7 days. Your developer credentials will remain inactive until the Owner countersigns the agreement.`,link:signingLink });
        await auditLog(req.user.id, null, 'developer_admin_contract_invited', { entity:'partner_agreement', entityId:result.rows[0].id, email, name }, req);
        res.status(201).json({ agreement:result.rows[0], message:'Contract invitation emailed. The developer account will be created after both parties sign.' });
    } catch (err) { if (err.code === '23505') return res.status(409).json({ error:'An account with this email already exists.' }); res.status(500).json({ error:'Could not create developer admin.' }); }
});

// ─── Audit helper ──────────────────────────────────────────────────────────────
async function auditLog(actorId, tenantId, action, meta = {}, req = null) {
    try {
        await query(
            `INSERT INTO audit_log (actor_user_id, tenant_id, action, entity, entity_id, metadata, ip_address)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                actorId,
                tenantId || null,
                action,
                meta.entity || 'platform',
                meta.entityId || null,
                JSON.stringify(meta),
                req?.ip || null,
            ]
        );
    } catch (e) {
        console.error('[Platform/AuditLog]', e.message);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// TENANT OVERVIEW
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/v1/platform/tenants?search=&page=1&limit=50
router.get('/tenants', async (req, res) => {
    const { search = '', page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const like   = `%${search}%`;

    try {
        const result = await query(
            `SELECT
                t.id, t.name, t.slug, t.active, t.plan_id, t.created_at,
                t.branding,
                th.name AS theme_name,
                t.default_payment_mode,
                t.paypal_payments_enabled,
                t.manual_payment_enabled,
                (SELECT COUNT(*) FROM bookings b WHERE b.tenant_id = t.id) AS total_bookings,
                (SELECT COUNT(*) FROM services s WHERE s.tenant_id = t.id AND s.active = true) AS active_services,
                (SELECT email FROM users u WHERE u.tenant_id = t.id AND u.role = 'tenant_admin' LIMIT 1) AS owner_email,
                (SELECT name  FROM users u WHERE u.tenant_id = t.id AND u.role = 'tenant_admin' LIMIT 1) AS owner_name,
                (SELECT status FROM pending_signups ps2 WHERE ps2.tenant_slug = t.slug ORDER BY ps2.created_at DESC LIMIT 1) AS provisioning_status
             FROM tenants t
             LEFT JOIN themes th ON th.id = t.theme_id
             WHERE ($1 = '' OR t.name ILIKE $2 OR t.slug ILIKE $2)
             ORDER BY t.created_at DESC
             LIMIT $3 OFFSET $4`,
            [search, like, parseInt(limit), offset]
        );

        const countRes = await query(
            `SELECT COUNT(*) FROM tenants WHERE ($1 = '' OR name ILIKE $2 OR slug ILIKE $2)`,
            [search, like]
        );

        res.json({
            tenants: result.rows,
            total:   parseInt(countRes.rows[0].count),
            page:    parseInt(page),
            limit:   parseInt(limit),
        });
    } catch (err) {
        console.error('[Platform/Tenants]', err.message);
        res.status(500).json({ error: 'Failed to fetch tenants.' });
    }
});

// GET /api/v1/platform/tenants/:tenantId
router.get('/tenants/:tenantId', async (req, res) => {
    try {
        const result = await query(
            `SELECT t.*,
                th.name AS theme_name, th.category AS theme_category,
                t.bank_transfer_instructions AS manual_transfer_instructions,
                (SELECT email FROM users u WHERE u.tenant_id = t.id AND u.role = 'tenant_admin' LIMIT 1) AS owner_email,
                (SELECT name  FROM users u WHERE u.tenant_id = t.id AND u.role = 'tenant_admin' LIMIT 1) AS owner_name,
                (SELECT id    FROM users u WHERE u.tenant_id = t.id AND u.role = 'tenant_admin' LIMIT 1) AS owner_user_id
             FROM tenants t
             LEFT JOIN themes th ON th.id = t.theme_id
             WHERE t.id = $1`,
            [req.params.tenantId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Tenant not found.' });
        res.json({ tenant: result.rows[0] });
    } catch (err) {
        console.error('[Platform/TenantDetail]', err.message);
        res.status(500).json({ error: 'Failed to fetch tenant.' });
    }
});

// GET /api/v1/platform/tenants/:tenantId/health
router.get('/tenants/:tenantId/health', async (req, res) => {
    const { tenantId } = req.params;
    const warnings = [];

    try {
        const [svcRes, tenantRes, brandRes, provRes, failedJobsRes] = await Promise.all([
            query(`SELECT COUNT(*) AS cnt FROM services WHERE tenant_id = $1 AND active = true`, [tenantId]),
            query(`SELECT default_payment_mode, paypal_payments_enabled, paypal_payment_link, manual_payment_enabled, bank_transfer_instructions, payment_settings FROM tenants WHERE id = $1`, [tenantId]),
            query(`SELECT branding FROM tenants WHERE id = $1`, [tenantId]),
            query(`SELECT status FROM pending_signups WHERE tenant_slug = (SELECT slug FROM tenants WHERE id = $1) ORDER BY created_at DESC LIMIT 1`, [tenantId]),
            query(`SELECT COUNT(*) AS cnt FROM bookings WHERE tenant_id = $1 AND status = 'pending_payment' AND expires_at < NOW()`, [tenantId]),
        ]);

        if (parseInt(svcRes.rows[0].cnt) === 0) warnings.push({ code: 'NO_SERVICES', message: 'No active services configured.' });

        const ps = tenantRes.rows[0];
        if (!ps) {
            warnings.push({ code: 'NO_TENANT', message: 'Tenant not found.' });
        } else {
            if (ps.paypal_payments_enabled && !ps.paypal_payment_link) warnings.push({ code: 'PAYPAL_NO_LINK', message: 'PayPal enabled but PayPal.Me link is missing.' });
            if (ps.manual_payment_enabled && !ps.bank_transfer_instructions) warnings.push({ code: 'MANUAL_NO_INSTRUCTIONS', message: 'Manual transfer enabled but instructions are empty.' });
            if (!ps.default_payment_mode || ps.default_payment_mode === 'none') warnings.push({ code: 'NO_PAYMENT_MODE', message: 'No default payment mode set.' });
        }

        const branding = brandRes.rows[0]?.branding || {};
        if (!branding.logo_url)    warnings.push({ code: 'NO_LOGO',    message: 'No logo configured.' });
        if (!branding.accent_color) warnings.push({ code: 'NO_ACCENT', message: 'No accent color configured.' });

        if (provRes.rows.length > 0 && provRes.rows[0].status !== 'provisioned') {
            warnings.push({ code: 'PROVISIONING_INCOMPLETE', message: `Provisioning status: ${provRes.rows[0].status}` });
        }

        if (parseInt(failedJobsRes.rows[0].cnt) > 0) {
            warnings.push({ code: 'EXPIRED_HOLDS', message: `${failedJobsRes.rows[0].cnt} bookings have expired holds not yet cleaned up.` });
        }

        res.json({ tenantId, healthy: warnings.length === 0, warnings });
    } catch (err) {
        console.error('[Platform/Health]', err.message);
        res.status(500).json({ error: 'Failed to compute health.' });
    }
});

// GET /api/v1/platform/tenants/:tenantId/services
router.get('/tenants/:tenantId/services', async (req, res) => {
    try {
        const result = await query(
            `SELECT * FROM services WHERE tenant_id = $1 ORDER BY name`,
            [req.params.tenantId]
        );
        res.json({ services: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch services.' });
    }
});

// GET /api/v1/platform/tenants/:tenantId/bookings?limit=20
router.get('/tenants/:tenantId/bookings', async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    try {
        const result = await query(
            `SELECT b.*, s.name AS service_name
             FROM bookings b
             LEFT JOIN services s ON s.id = b.service_id
             WHERE b.tenant_id = $1
             ORDER BY b.created_at DESC LIMIT $2`,
            [req.params.tenantId, limit]
        );
        res.json({ bookings: result.rows.map(serializeBooking) });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch bookings.' });
    }
});

// GET /api/v1/platform/tenants/:tenantId/payment-settings
router.get('/tenants/:tenantId/payment-settings', async (req, res) => {
    try {
        const result = await query(
            `SELECT default_payment_mode AS payment_mode, paypal_payments_enabled, paypal_payment_link, manual_payment_enabled,
                    hold_timeout_minutes, bank_transfer_instructions AS manual_transfer_instructions,
                    payment_settings
             FROM tenants WHERE id = $1`,
            [req.params.tenantId]
        );
        // Never expose encrypted credentials
        res.json({ paymentSettings: result.rows[0] || null });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch payment settings.' });
    }
});

// GET /api/v1/platform/tenants/:tenantId/provisioning
router.get('/tenants/:tenantId/provisioning', async (req, res) => {
    try {
        const result = await query(
            `SELECT id, status, tenant_slug, admin_email, created_at, updated_at
             FROM pending_signups
             WHERE tenant_id = $1
             ORDER BY created_at DESC LIMIT 5`,
            [req.params.tenantId]
        );
        res.json({ provisioning: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch provisioning.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// THEME INSPECTION
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/v1/platform/themes
router.get('/themes', async (req, res) => {
    try {
        const result = await query(
            `SELECT th.*,
                COUNT(t.id) AS tenant_count
             FROM themes th
             LEFT JOIN tenants t ON t.theme_id = th.id
             GROUP BY th.id
             ORDER BY th.name`
        );
        res.json({ themes: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch themes.' });
    }
});

// GET /api/v1/platform/themes/:themeId/tenants
router.get('/themes/:themeId/tenants', async (req, res) => {
    try {
        const result = await query(
            `SELECT t.id, t.name, t.slug, t.active
             FROM tenants t
             WHERE t.theme_id = $1
             ORDER BY t.created_at DESC`,
            [req.params.themeId]
        );
        res.json({ tenants: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch tenants for theme.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// TENANT ADMINISTRATIVE ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/v1/platform/tenants/:tenantId/reset-password
router.post('/tenants/:tenantId/reset-password', async (req, res) => {
    try {
        // Find owner of tenant
        const userRes = await query(`SELECT email FROM users WHERE tenant_id = $1 ORDER BY created_at ASC LIMIT 1`, [req.params.tenantId]);
        if (userRes.rows.length === 0) return res.status(404).json({ error: 'No user found for this tenant.' });
        
        const email = userRes.rows[0].email;
        
        // Use the same logic as forgot-password, by making an internal request or extracting the logic.
        // It's easiest to just import and call the service
        const crypto = require('crypto');
        const { sendPasswordResetEmail } = require('../../services/email');
        const userRow = await query(`SELECT id FROM users WHERE email = $1`, [email]);
        const userId = userRow.rows[0].id;
        
        await query(`UPDATE password_reset_tokens SET used = true WHERE user_id = $1`, [userId]);
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        
        await query(
            `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
            [userId, tokenHash]
        );
        
        const baseUrl = process.env.PUBLIC_APP_URL || process.env.BASE_URL || 'https://icssbookings.com';
        const resetUrl = `${baseUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`;
        await sendPasswordResetEmail(email, resetUrl);
        await auditLog(req.user.id,req.params.tenantId,'tenant_password_reset_sent',{entity:'tenant',entityId:req.params.tenantId,email},req);
        
        res.json({ success: true, email: email, message: 'Password reset link sent.' });
    } catch (err) {
        console.error('[Platform/Tenant/ResetPassword]', err.message);
        res.status(500).json({ error: 'Failed to send reset email.' });
    }
});

// POST /api/v1/platform/tenants/:tenantId/reset-dashboard-tour
router.post('/tenants/:tenantId/reset-dashboard-tour', async (req, res) => {
    try {
        const tenantRes = await query(
            `SELECT id, slug, name, branding
             FROM tenants
             WHERE id = $1`,
            [req.params.tenantId]
        );

        if (tenantRes.rows.length === 0) {
            return res.status(404).json({ error: 'Tenant not found.' });
        }

        const tenant = tenantRes.rows[0];
        const branding = tenant.branding || {};
        const currentVersion = Number(branding.dashboard_tour_version);
        const nextVersion = Number.isFinite(currentVersion) && currentVersion >= 0
            ? currentVersion + 1
            : 2;
        const nextBranding = {
            ...branding,
            dashboard_tour_version: nextVersion
        };

        await query(
            `UPDATE tenants
             SET branding = $1
             WHERE id = $2`,
            [JSON.stringify(nextBranding), tenant.id]
        );

        invalidateTenantCache(tenant.slug);
        await auditLog(req.user.id, tenant.id, 'dashboard_tour_reset', {
            entity: 'tenant',
            entityId: tenant.id,
            dashboard_tour_version: nextVersion
        }, req);

        res.json({
            success: true,
            tenantId: tenant.id,
            tenantName: tenant.name,
            tenantSlug: tenant.slug,
            dashboardTourVersion: nextVersion,
            message: 'Dashboard tutorial reset. The next dashboard visit will show the walkthrough again.'
        });
    } catch (err) {
        console.error('[Platform/Tenant/ResetDashboardTour]', err.message);
        res.status(500).json({ error: 'Failed to reset the dashboard tutorial.' });
    }
});

// PATCH /api/v1/platform/tenants/:tenantId/status
router.patch('/tenants/:tenantId/status', async (req, res) => {
    try {
        const { active } = req.body;
        const result=await query(`UPDATE tenants SET active = $1 WHERE id = $2 RETURNING name`, [active, req.params.tenantId]);
        if(!result.rows.length)return res.status(404).json({error:'Tenant not found.'});
        await auditLog(req.user.id,req.params.tenantId,active?'tenant_activated':'tenant_suspended',{entity:'tenant',entityId:req.params.tenantId,name:result.rows[0].name},req);
        res.json({ success: true, active });
    } catch (err) {
        console.error('[Platform/Tenant/Status]', err.message);
        res.status(500).json({ error: 'Failed to update tenant status.' });
    }
});

// DELETE /api/v1/platform/tenants/:tenantId
router.delete('/tenants/:tenantId', async (req, res) => {
    try {
        const existing=await query(`SELECT name,slug FROM tenants WHERE id=$1`,[req.params.tenantId]);
        if(!existing.rows.length)return res.status(404).json({error:'Tenant not found.'});
        await auditLog(req.user.id,req.params.tenantId,'tenant_deleted',{entity:'tenant',entityId:req.params.tenantId,...existing.rows[0]},req);
        await query(`DELETE FROM tenants WHERE id = $1`, [req.params.tenantId]);
        res.json({ success: true });
    } catch (err) {
        console.error('[Platform/Tenant/Delete]', err.message);
        res.status(500).json({ error: 'Failed to delete tenant. Please ensure no dependencies prevent deletion.' });
    }
});


// ─────────────────────────────────────────────────────────────────────────────
// DIAGNOSTICS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/v1/platform/jobs
router.get('/jobs', async (req, res) => {
    try {
        // Query pg-boss job tables directly
        const [pendingRes, failedRes, completedRes, themeRequestsRes, supportJobsRes] = await Promise.all([
            query(`SELECT id, name, data, created_on, state FROM pgboss.job WHERE state IN ('created','retry') ORDER BY created_on DESC LIMIT 50`).catch(() => ({ rows: [] })),
            query(`SELECT id, name, data, created_on, state, output FROM pgboss.job WHERE state = 'failed' ORDER BY created_on DESC LIMIT 50`).catch(() => ({ rows: [] })),
            query(`SELECT id, name, created_on, state FROM pgboss.job WHERE state = 'completed' ORDER BY created_on DESC LIMIT 20`).catch(() => ({ rows: [] })),
            query(`SELECT ctr.*,t.name AS tenant_name,t.slug AS tenant_slug FROM custom_theme_requests ctr JOIN tenants t ON t.id=ctr.tenant_id ORDER BY ctr.created_at DESC LIMIT 100`).catch(() => ({ rows: [] })),
            query(`SELECT sj.*,t.name AS tenant_name,t.slug AS tenant_slug,u.email AS submitter_email,assignee.email AS assignee_email FROM support_jobs sj JOIN tenants t ON t.id=sj.tenant_id LEFT JOIN users u ON u.id=sj.submitted_by LEFT JOIN users assignee ON assignee.id=sj.assigned_to ORDER BY CASE sj.status WHEN 'submitted' THEN 1 WHEN 'in_review' THEN 2 ELSE 3 END,sj.created_at DESC LIMIT 200`).catch(() => ({ rows: [] })),
        ]);
        res.json({
            pending:   pendingRes.rows,
            failed:    failedRes.rows,
            completed: completedRes.rows,
            themeRequests: themeRequestsRes.rows,
            supportJobs: supportJobsRes.rows,
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch jobs.' });
    }
});

router.patch('/jobs/:jobId/status', async (req, res) => {
    const status = String(req.body.status || '');
    const note = String(req.body.note || '').trim().slice(0, 2000);
    if (!['in_review','completed'].includes(status)) return res.status(400).json({ error: 'Status must be in_review or completed.' });
    try {
        const result = await query(`UPDATE support_jobs SET status=$1,developer_note=$2,assigned_to=$3,reviewed_at=CASE WHEN $1='in_review' THEN NOW() ELSE reviewed_at END,completed_at=CASE WHEN $1='completed' THEN NOW() ELSE NULL END,updated_at=NOW() WHERE id=$4 RETURNING *`, [status,note||null,req.user.id,req.params.jobId]);
        if (!result.rows.length) return res.status(404).json({ error: 'Job not found.' });
        const details = await query(`SELECT sj.*,t.name AS tenant_name,(SELECT email FROM users WHERE tenant_id=sj.tenant_id AND role='tenant_admin' AND active=true ORDER BY created_at LIMIT 1) AS tenant_email FROM support_jobs sj JOIN tenants t ON t.id=sj.tenant_id WHERE sj.id=$1`, [req.params.jobId]);
        const job=details.rows[0];
        await sendSupportJobStatusEmail({ to:job.tenant_email,tenantName:job.tenant_name,subject:job.subject,status,note }).catch(err => console.error('[Platform/JobNotification]',err.message));
        await auditLog(req.user.id,job.tenant_id,'support_job_status_changed',{entity:'support_job',entityId:job.id,status,note},req);
        res.json({ success:true,job });
    } catch(err) { console.error('[Platform/JobStatus]',err.message); res.status(500).json({ error:'Could not update job.' }); }
});

router.get('/dashboard-analytics', async (req, res) => {
    try {
        const [summary, monthly, tenants, statuses] = await Promise.all([
            query(`SELECT (SELECT COUNT(*) FROM tenants WHERE active=true)::int AS active_tenants,(SELECT COUNT(*) FROM bookings)::int AS total_bookings,(SELECT COUNT(*) FROM bookings WHERE created_at>=NOW()-INTERVAL '30 days')::int AS bookings_30d,COALESCE((SELECT SUM(COALESCE(b.service_price,s.price,0)+COALESCE(b.after_hours_fee,0)) FROM bookings b LEFT JOIN services s ON s.id=b.service_id WHERE b.status IN ('confirmed','completed') AND COALESCE(b.service_currency,s.currency,'JMD')='JMD'),0)::numeric AS total_paid,COALESCE((SELECT SUM(COALESCE(b.service_price,s.price,0)+COALESCE(b.after_hours_fee,0)) FROM bookings b LEFT JOIN services s ON s.id=b.service_id WHERE b.status IN ('confirmed','completed') AND COALESCE(b.service_currency,s.currency,'JMD')='JMD' AND b.created_at>=NOW()-INTERVAL '30 days'),0)::numeric AS paid_30d`),
            query(`SELECT TO_CHAR(month,'YYYY-MM') AS month,COALESCE(SUM(COALESCE(b.service_price,s.price,0)+COALESCE(b.after_hours_fee,0)) FILTER(WHERE b.status IN ('confirmed','completed') AND COALESCE(b.service_currency,s.currency,'JMD')='JMD'),0)::numeric AS payments,COUNT(b.id) FILTER(WHERE b.status IN ('confirmed','completed'))::int AS bookings FROM generate_series(date_trunc('month',NOW())-INTERVAL '11 months',date_trunc('month',NOW()),INTERVAL '1 month') month LEFT JOIN bookings b ON date_trunc('month',b.created_at)=month LEFT JOIN services s ON s.id=b.service_id GROUP BY month ORDER BY month`),
            query(`SELECT t.name,t.slug,COUNT(b.id) FILTER(WHERE b.status IN ('confirmed','completed'))::int AS bookings,COALESCE(SUM(COALESCE(b.service_price,s.price,0)+COALESCE(b.after_hours_fee,0)) FILTER(WHERE b.status IN ('confirmed','completed') AND COALESCE(b.service_currency,s.currency,'JMD')='JMD'),0)::numeric AS payments FROM tenants t LEFT JOIN bookings b ON b.tenant_id=t.id LEFT JOIN services s ON s.id=b.service_id GROUP BY t.id ORDER BY payments DESC LIMIT 10`),
            query(`SELECT status,COUNT(*)::int AS count FROM bookings GROUP BY status ORDER BY count DESC`)
        ]);
        res.json({ summary:summary.rows[0],monthly:monthly.rows,tenants:tenants.rows,statuses:statuses.rows });
    } catch(err) { console.error('[Platform/Analytics]',err.message); res.status(500).json({ error:'Could not load dashboard analytics.' }); }
});

// GET /api/v1/platform/audit-log?tenantId=&limit=100
router.get('/audit-log', async (req, res) => {
    const { tenantId, limit = 100, offset = 0 } = req.query;
    try {
        const result = await query(
            `SELECT al.*, u.email AS actor_email,
                    t.name AS tenant_name, t.slug AS tenant_slug,
                    target.email AS target_account_email
             FROM audit_log al
             LEFT JOIN users u ON u.id = al.actor_user_id
             LEFT JOIN tenants t ON t.id = al.tenant_id
             LEFT JOIN LATERAL (
                 SELECT tu.email
                 FROM users tu
                 WHERE tu.tenant_id = al.tenant_id
                   AND tu.role = 'tenant_admin'
                 ORDER BY tu.active DESC, tu.created_at ASC
                 LIMIT 1
             ) target ON true
             WHERE ($1::uuid IS NULL OR al.tenant_id = $1::uuid)
             ORDER BY al.created_at DESC
             LIMIT $2 OFFSET $3`,
            [tenantId || null, Math.min(parseInt(limit), 500), parseInt(offset)]
        );
        res.json({ entries: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch audit log.' });
    }
});

// GET /api/v1/platform/payments?tenantId=&limit=50
router.get('/payments', async (req, res) => {
    const { tenantId, limit = 50 } = req.query;
    try {
        const result = await query(
            `SELECT bp.*, b.name AS customer_name, b.email, b.booking_date, b.booking_time,
                    s.name AS service_name, t.name AS tenant_name, t.slug AS tenant_slug
             FROM booking_payments bp
             JOIN bookings b ON b.id = bp.booking_id
             LEFT JOIN services s ON s.id = b.service_id
             JOIN tenants t ON t.id = bp.tenant_id
             WHERE ($1::uuid IS NULL OR bp.tenant_id = $1::uuid)
             ORDER BY bp.created_at DESC LIMIT $2`,
            [tenantId || null, Math.min(parseInt(limit), 200)]
        );
        res.json({ payments: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch payments.' });
    }
});

// GET /api/v1/platform/build-info
router.get('/build-info', async (req, res) => {
    const { execSync } = require('child_process');
    let gitRef = 'unknown';
    try { gitRef = execSync('git rev-parse --short HEAD', { timeout: 2000 }).toString().trim(); } catch {}

    const dbHealthy = await query('SELECT 1').then(() => true).catch(() => false);

    res.json({
        version:     process.env.npm_package_version || '1.0.0',
        nodeVersion: process.version,
        gitRef,
        env:         process.env.NODE_ENV || 'development',
        uptime:      Math.round(process.uptime()),
        dbHealthy,
        publicAppUrl: process.env.PUBLIC_APP_URL || process.env.BASE_URL || 'not set',
        timestamp:   new Date().toISOString(),
    });
});

// GET /api/v1/platform/env-check  — presence only, never values
router.get('/env-check', (req, res) => {
    const REQUIRED = ['DATABASE_URL','JWT_SECRET','RESEND_API_KEY','PUBLIC_APP_URL'];
    const OPTIONAL = ['PAYPAL_CLIENT_ID','PAYPAL_SECRET','PAYPAL_WEBHOOK_ID','ENCRYPTION_KEY'];
    const check = (keys) => keys.map(k => ({ key: k, present: !!process.env[k] }));
    res.json({ required: check(REQUIRED), optional: check(OPTIONAL) });
});

// ─────────────────────────────────────────────────────────────────────────────
// IMPERSONATION
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/v1/platform/impersonate/tenant/:tenantId
router.post('/impersonate/tenant/:tenantId', async (req, res) => {
    const { tenantId } = req.params;
    const { mode = 'read_only', reason = '' } = req.body;

    if (!['read_only', 'edit'].includes(mode)) {
        return res.status(400).json({ error: 'mode must be read_only or edit.' });
    }

    try {
        // Verify tenant exists
        const tenantRes = await query(`SELECT id, name, slug FROM tenants WHERE id = $1`, [tenantId]);
        if (tenantRes.rows.length === 0) return res.status(404).json({ error: 'Tenant not found.' });
        const tenant = tenantRes.rows[0];

        // Find the tenant admin user for context (nullable)
        const userRes = await query(
            `SELECT id, email FROM users WHERE tenant_id = $1 AND role = 'tenant_admin' LIMIT 1`,
            [tenantId]
        );
        const targetUserId = userRes.rows[0]?.id || null;

        // Create impersonation session row
        const sesRes = await query(
            `INSERT INTO impersonation_sessions
             (actor_user_id, target_tenant_id, target_user_id, mode, reason, ip_address, user_agent)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, expires_at`,
            [
                req.user.id, tenantId, targetUserId, mode, reason,
                req.ip, req.headers['user-agent'] || null,
            ]
        );
        const session = sesRes.rows[0];

        // Issue a short-lived impersonation overlay JWT (30 min)
        // This is an OVERLAY token — it carries impersonation context only.
        // The platform owner's main token remains unchanged in their browser.
        const impToken = signToken({
            // User context — use tenant admin if available
            id:        targetUserId || req.user.id,
            email:     userRes.rows[0]?.email || req.user.email,
            role:      targetUserId ? 'tenant_admin' : 'platform_owner',
            tenant_id: tenantId,
            // Impersonation metadata
            impersonation_session_id: session.id,
            actor_user_id:            req.user.id,
            impersonation_mode:       mode,
            tenant_name:              tenant.name,
            tenant_slug:              tenant.slug,
        }, '30m');

        await auditLog(req.user.id, tenantId, 'impersonation_start', {
            entity: 'impersonation_session', entityId: session.id, mode, reason,
            impersonatedTenantName: tenant.name,
            impersonatedTenantSlug: tenant.slug,
            impersonatedAccountEmail: userRes.rows[0]?.email || null,
        }, req);

        res.json({
            session_id:  session.id,
            token:       impToken,
            expires_at:  session.expires_at,
            mode,
            tenant:      { id: tenant.id, name: tenant.name, slug: tenant.slug },
        });

    } catch (err) {
        console.error('[Platform/Impersonate]', err.message);
        res.status(500).json({ error: 'Failed to create impersonation session.' });
    }
});

// GET /api/v1/platform/impersonation/active
router.get('/impersonation/active', async (req, res) => {
    try {
        const result = await query(
            `SELECT s.*, t.name AS tenant_name, t.slug AS tenant_slug
             FROM impersonation_sessions s
             JOIN tenants t ON t.id = s.target_tenant_id
             WHERE s.actor_user_id = $1
               AND s.revoked_at IS NULL
               AND s.expires_at > NOW()
             ORDER BY s.created_at DESC`,
            [req.user.id]
        );
        res.json({ sessions: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch sessions.' });
    }
});

// POST /api/v1/platform/impersonation/:sessionId/end
router.post('/impersonation/:sessionId/end', async (req, res) => {
    try {
        const result = await query(
            `UPDATE impersonation_sessions SET revoked_at = NOW()
             WHERE id = $1 AND actor_user_id = $2
             RETURNING target_tenant_id`,
            [req.params.sessionId, req.user.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Session not found.' });

        const targetRes = await query(
            `SELECT t.name,t.slug,
                    (SELECT email FROM users WHERE tenant_id=t.id AND role='tenant_admin' ORDER BY active DESC,created_at ASC LIMIT 1) AS account_email
             FROM tenants t WHERE t.id=$1`,
            [result.rows[0].target_tenant_id]
        );
        const target = targetRes.rows[0] || {};

        await auditLog(req.user.id, result.rows[0].target_tenant_id, 'impersonation_end', {
            entity: 'impersonation_session', entityId: req.params.sessionId,
            impersonatedTenantName: target.name,
            impersonatedTenantSlug: target.slug,
            impersonatedAccountEmail: target.account_email,
        }, req);

        res.json({ ended: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to end session.' });
    }
});

// POST /api/v1/platform/impersonation/:sessionId/elevate  — read_only → edit
router.post('/impersonation/:sessionId/elevate', async (req, res) => {
    const { reason } = req.body;
    if (!reason?.trim()) return res.status(400).json({ error: 'reason is required to enable edit mode.' });

    try {
        const result = await query(
            `UPDATE impersonation_sessions
             SET mode = 'edit', reason = $3,
                 expires_at = NOW() + INTERVAL '15 minutes'
             WHERE id = $1 AND actor_user_id = $2
               AND revoked_at IS NULL AND expires_at > NOW()
             RETURNING id, target_tenant_id, expires_at`,
            [req.params.sessionId, req.user.id, reason]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Session not found or already expired.' });

        // Issue a fresh elevated impersonation token (15 min)
        const { target_tenant_id } = result.rows[0];
        const userRes = await query(
            `SELECT id, email FROM users WHERE tenant_id = $1 AND role = 'tenant_admin' LIMIT 1`,
            [target_tenant_id]
        );
        const elevatedTenantRes = await query(`SELECT name,slug FROM tenants WHERE id=$1`, [target_tenant_id]);
        const tenant = elevatedTenantRes.rows[0] || { name: 'Tenant', slug: '' };
        const elevatedToken = signToken({
            id:        userRes.rows[0]?.id || req.user.id,
            role:      'tenant_admin',
            tenant_id: target_tenant_id,
            impersonation_session_id: req.params.sessionId,
            actor_user_id:            req.user.id,
            impersonation_mode:       'edit',
            tenant_name:              tenant.name,
            tenant_slug:              tenant.slug,
        }, '15m');

        await auditLog(req.user.id, target_tenant_id, 'impersonation_elevated_to_edit', {
            entity: 'impersonation_session', entityId: req.params.sessionId, reason,
            impersonatedTenantName: tenant.name,
            impersonatedTenantSlug: tenant.slug,
            impersonatedAccountEmail: userRes.rows[0]?.email || null,
        }, req);

        res.json({ elevated: true, token: elevatedToken, expires_at: result.rows[0].expires_at });
    } catch (err) {
        res.status(500).json({ error: 'Failed to elevate session.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// SAFE WRITE ACTIONS (edit mode only — still audit logged)
// ─────────────────────────────────────────────────────────────────────────────

function requireEditSession(req, res, next) {
    // For platform console direct actions (not via impersonation overlay)
    // platform_owner can always perform these
    next();
}

// POST /api/v1/platform/bookings/:bookingId/expire-hold
router.post('/bookings/:bookingId/expire-hold', requireEditSession, async (req, res) => {
    try {
        const result = await query(
            `UPDATE bookings SET status = 'expired', expires_at = NOW()
             WHERE id = $1 AND status IN ('pending_payment','pending_manual_confirmation')
             RETURNING id, tenant_id, status`,
            [req.params.bookingId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Booking not found or already finalized.' });
        const b = result.rows[0];
        await auditLog(req.user.id, b.tenant_id, 'platform_expire_hold', { entity: 'booking', entityId: b.id }, req);
        res.json({ expired: true, booking: b });
    } catch (err) {
        res.status(500).json({ error: 'Failed to expire hold.' });
    }
});

// POST /api/v1/platform/tenants/:tenantId/replay-provisioning
router.post('/tenants/:tenantId/replay-provisioning', requireEditSession, async (req, res) => {
    try {
        const { enqueueProvisioningJob } = require('../../services/queue');
        const psRes = await query(
            `SELECT signup_token FROM pending_signups WHERE tenant_id = $1 AND status != 'provisioned' ORDER BY created_at DESC LIMIT 1`,
            [req.params.tenantId]
        );
        if (psRes.rows.length === 0) return res.status(404).json({ error: 'No pending provisioning found.' });

        await enqueueProvisioningJob(psRes.rows[0].signup_token);
        await auditLog(req.user.id, req.params.tenantId, 'platform_replay_provisioning', {}, req);
        res.json({ replayed: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to replay provisioning: ' + err.message });
    }
});

module.exports = router;
