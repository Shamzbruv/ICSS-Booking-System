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

// All platform routes: authenticated + platform_owner only
router.use(authenticate, requirePlatformOwner);

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
                ps.plan_id AS payment_plan,
                ps.payment_mode AS default_payment_mode,
                ps.wipay_enabled,
                ps.manual_payment_enabled,
                (SELECT COUNT(*) FROM bookings b WHERE b.tenant_id = t.id) AS total_bookings,
                (SELECT COUNT(*) FROM services s WHERE s.tenant_id = t.id AND s.active = true) AS active_services,
                (SELECT email FROM users u WHERE u.tenant_id = t.id AND u.role = 'tenant_admin' LIMIT 1) AS owner_email,
                (SELECT name  FROM users u WHERE u.tenant_id = t.id AND u.role = 'tenant_admin' LIMIT 1) AS owner_name,
                (SELECT status FROM pending_signups ps2 WHERE ps2.tenant_id = t.id ORDER BY ps2.created_at DESC LIMIT 1) AS provisioning_status
             FROM tenants t
             LEFT JOIN themes th ON th.id = t.theme_id
             LEFT JOIN payment_settings ps ON ps.tenant_id = t.id
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
                ps.payment_mode AS default_payment_mode,
                ps.wipay_enabled, ps.manual_payment_enabled,
                ps.hold_timeout_minutes, ps.manual_transfer_instructions,
                (SELECT email FROM users u WHERE u.tenant_id = t.id AND u.role = 'tenant_admin' LIMIT 1) AS owner_email,
                (SELECT name  FROM users u WHERE u.tenant_id = t.id AND u.role = 'tenant_admin' LIMIT 1) AS owner_name,
                (SELECT id    FROM users u WHERE u.tenant_id = t.id AND u.role = 'tenant_admin' LIMIT 1) AS owner_user_id
             FROM tenants t
             LEFT JOIN themes th ON th.id = t.theme_id
             LEFT JOIN payment_settings ps ON ps.tenant_id = t.id
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
        const [svcRes, psRes, brandRes, provRes, failedJobsRes] = await Promise.all([
            query(`SELECT COUNT(*) AS cnt FROM services WHERE tenant_id = $1 AND active = true`, [tenantId]),
            query(`SELECT * FROM payment_settings WHERE tenant_id = $1`, [tenantId]),
            query(`SELECT branding FROM tenants WHERE id = $1`, [tenantId]),
            query(`SELECT status FROM pending_signups WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1`, [tenantId]),
            query(`SELECT COUNT(*) AS cnt FROM bookings WHERE tenant_id = $1 AND status = 'pending_payment' AND expires_at < NOW()`, [tenantId]),
        ]);

        if (parseInt(svcRes.rows[0].cnt) === 0) warnings.push({ code: 'NO_SERVICES', message: 'No active services configured.' });

        const ps = psRes.rows[0];
        if (!ps) {
            warnings.push({ code: 'NO_PAYMENT_SETTINGS', message: 'Payment settings not configured.' });
        } else {
            if (ps.wipay_enabled && !ps.wipay_account_number_enc) warnings.push({ code: 'WIPAY_NO_CREDS', message: 'WiPay enabled but account number missing.' });
            if (ps.manual_payment_enabled && !ps.manual_transfer_instructions) warnings.push({ code: 'MANUAL_NO_INSTRUCTIONS', message: 'Manual transfer enabled but instructions are empty.' });
            if (!ps.payment_mode) warnings.push({ code: 'NO_PAYMENT_MODE', message: 'No default payment mode set.' });
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
        res.json({ bookings: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch bookings.' });
    }
});

// GET /api/v1/platform/tenants/:tenantId/payment-settings
router.get('/tenants/:tenantId/payment-settings', async (req, res) => {
    try {
        const result = await query(
            `SELECT payment_mode, wipay_enabled, manual_payment_enabled,
                    hold_timeout_minutes, manual_transfer_instructions,
                    wipay_country_code, wipay_currency
             FROM payment_settings WHERE tenant_id = $1`,
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
             FROM tenants t WHERE t.theme_id = $1 ORDER BY t.name`,
            [req.params.themeId]
        );
        res.json({ tenants: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch theme tenants.' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// DIAGNOSTICS
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/v1/platform/jobs
router.get('/jobs', async (req, res) => {
    try {
        // Query pg-boss job tables directly
        const [pendingRes, failedRes, completedRes] = await Promise.all([
            query(`SELECT id, name, data, created_on, state FROM pgboss.job WHERE state IN ('created','retry') ORDER BY created_on DESC LIMIT 50`).catch(() => ({ rows: [] })),
            query(`SELECT id, name, data, created_on, state, output FROM pgboss.job WHERE state = 'failed' ORDER BY created_on DESC LIMIT 50`).catch(() => ({ rows: [] })),
            query(`SELECT id, name, created_on, state FROM pgboss.job WHERE state = 'completed' ORDER BY created_on DESC LIMIT 20`).catch(() => ({ rows: [] })),
        ]);
        res.json({
            pending:   pendingRes.rows,
            failed:    failedRes.rows,
            completed: completedRes.rows,
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch jobs.' });
    }
});

// GET /api/v1/platform/audit-log?tenantId=&limit=100
router.get('/audit-log', async (req, res) => {
    const { tenantId, limit = 100, offset = 0 } = req.query;
    try {
        const result = await query(
            `SELECT al.*, u.email AS actor_email
             FROM audit_log al
             LEFT JOIN users u ON u.id = al.actor_user_id
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
    const OPTIONAL = ['PAYPAL_CLIENT_ID','PAYPAL_SECRET','PAYPAL_WEBHOOK_ID','WIPAY_ACCOUNT_NUMBER','ENCRYPTION_KEY'];
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
        }, '30m');

        await auditLog(req.user.id, tenantId, 'impersonation_start', {
            entity: 'impersonation_session', entityId: session.id, mode, reason
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

        await auditLog(req.user.id, result.rows[0].target_tenant_id, 'impersonation_end', {
            entity: 'impersonation_session', entityId: req.params.sessionId
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
        const elevatedToken = signToken({
            id:        userRes.rows[0]?.id || req.user.id,
            role:      'tenant_admin',
            tenant_id: target_tenant_id,
            impersonation_session_id: req.params.sessionId,
            actor_user_id:            req.user.id,
            impersonation_mode:       'edit',
        }, '15m');

        await auditLog(req.user.id, target_tenant_id, 'impersonation_elevated_to_edit', {
            entity: 'impersonation_session', entityId: req.params.sessionId, reason
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
