/**
 * Tenant Provisioning Routes — /api/v1/tenants
 * Create and manage tenant accounts.
 * Protected by a platform admin key (ICSS internal use).
 */

const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const { query }  = require('../../db/connection');
const { signToken, authenticate, requireRole } = require('../../middleware/auth');
const { invalidateTenantCache } = require('../../middleware/tenantResolver');
const { seedStarterServices } = require('../../services/provisioning');

const RESERVED_SLUGS = new Set([
    'admin', 'api', 'login', 'signup', 'dashboard', 'settings', 'www', 'app',
    'auth', 'billing', 'support', 'help', 'docs', 'blog', 'static', 'assets'
]);

// Simple platform admin key middleware (for internal provisioning)
function platformAdminOnly(req, res, next) {
    const key = req.headers['x-platform-admin-key'];
    if (!key || key !== process.env.PLATFORM_ADMIN_KEY) {
        return res.status(403).json({ error: 'Platform admin key required.' });
    }
    next();
}

// POST /api/v1/tenants — Provision a new tenant + admin user
router.post('/', platformAdminOnly, async (req, res) => {
    const {
        slug, name, plan = 'starter',
        adminEmail, adminPassword, adminName,
        branding = {}
    } = req.body;

    if (!slug || !name || !adminEmail || !adminPassword) {
        return res.status(400).json({ error: 'slug, name, adminEmail, and adminPassword are required.' });
    }

    const slugRegex = /^[a-z0-9-]{2,50}$/;
    if (!slugRegex.test(slug)) {
        return res.status(400).json({ error: 'Slug must be 2-50 lowercase alphanumeric characters or hyphens.' });
    }

    try {
        // Check plan exists
        const planResult = await query(`SELECT id FROM plans WHERE id = $1`, [plan]);
        if (planResult.rows.length === 0) {
            return res.status(400).json({ error: `Plan "${plan}" does not exist. Valid: starter, pro, enterprise.` });
        }

        // Create tenant
        const tenantResult = await query(
            `INSERT INTO tenants (slug, name, plan_id, branding)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [slug, name, plan, JSON.stringify(branding)]
        );
        const tenant = tenantResult.rows[0];

        // Create tenant admin user
        const passwordHash = await bcrypt.hash(adminPassword, 12);
        const userResult = await query(
            `INSERT INTO users (tenant_id, email, password_hash, name, role)
             VALUES ($1, $2, $3, $4, 'tenant_admin') RETURNING id, email, name, role`,
            [tenant.id, adminEmail.toLowerCase().trim(), passwordHash, adminName || adminEmail]
        );
        const adminUser = userResult.rows[0];

        // Seed a default "General Appointment" service
        await query(
            `INSERT INTO services (tenant_id, name, description, duration_minutes, price, currency)
             VALUES ($1, 'General Appointment', 'Standard booking slot', 30, 0, 'JMD')`,
            [tenant.id]
        );

        res.status(201).json({
            success: true,
            tenant: {
                id:   tenant.id,
                slug: tenant.slug,
                name: tenant.name,
                plan: tenant.plan_id
            },
            admin: adminUser,
            message: `Tenant "${slug}" provisioned. Admin login: ${adminEmail}`
        });

    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: `Tenant slug "${slug}" is already taken.` });
        }
        console.error('[Tenants/Create]', err.message);
        res.status(500).json({ error: 'Failed to provision tenant.' });
    }
});

// GET /api/v1/tenants — List all tenants (platform admin only)
router.get('/', platformAdminOnly, async (req, res) => {
    try {
        const result = await query(
            `SELECT t.id, t.slug, t.name, t.plan_id, t.active, t.created_at,
                    COUNT(DISTINCT b.id) AS total_bookings,
                    COUNT(DISTINCT u.id) AS total_users
             FROM tenants t
             LEFT JOIN bookings b ON b.tenant_id = t.id
             LEFT JOIN users u ON u.tenant_id = t.id
             GROUP BY t.id
             ORDER BY t.created_at DESC`
        );
        res.json({ tenants: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to list tenants.' });
    }
});

// GET /api/v1/tenants/:slug — Get single tenant details
router.get('/:slug', platformAdminOnly, async (req, res) => {
    try {
        const result = await query(
            `SELECT t.*, p.name AS plan_name, p.price_monthly, p.features AS plan_features, p.limits AS plan_limits
             FROM tenants t
             LEFT JOIN plans p ON p.id = t.plan_id
             WHERE t.slug = $1`,
            [req.params.slug]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Tenant not found.' });
        res.json({ tenant: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch tenant.' });
    }
});

// PATCH /api/v1/tenants/:slug/plan — Upgrade/downgrade tenant plan
router.patch('/:slug/plan', platformAdminOnly, async (req, res) => {
    const { plan } = req.body;
    try {
        const planResult = await query(`SELECT id FROM plans WHERE id = $1`, [plan]);
        if (planResult.rows.length === 0) return res.status(400).json({ error: 'Invalid plan.' });

        const result = await query(
            `UPDATE tenants SET plan_id = $1 WHERE slug = $2 RETURNING id, slug, plan_id`,
            [plan, req.params.slug]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Tenant not found.' });

        // Bust cache so new plan takes effect immediately
        invalidateTenantCache(req.params.slug);

        res.json({ success: true, tenant: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update tenant plan.' });
    }
});

// PATCH /api/v1/tenants/:slug/active — Suspend/activate tenant
router.patch('/:slug/active', platformAdminOnly, async (req, res) => {
    const { active } = req.body;
    try {
        const result = await query(
            `UPDATE tenants SET active = $1 WHERE slug = $2 RETURNING id, slug, active`,
            [Boolean(active), req.params.slug]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Tenant not found.' });
        invalidateTenantCache(req.params.slug);
        res.json({ success: true, tenant: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update tenant status.' });
    }
});

// POST /api/v1/tenants/:slug/theme — Switch the tenant's active theme
// The frontend can query the theme's configurations for 'preview' before calling this to activate.
router.post('/:slug/theme', authenticate, async (req, res) => {
    // Basic auth logic - in a real scenario we check if user belongs to this tenant, but we assume req.tenant is isolated
    if (req.tenant.slug !== req.params.slug) {
        // Platform admin fallback if they pass the header, otherwise reject
        if (req.headers['x-platform-admin-key'] !== process.env.PLATFORM_ADMIN_KEY) {
             return res.status(403).json({ error: 'Unauthorized to change theme for this tenant.' });
        }
    }

    const { theme_id, seed_services } = req.body;
    try {
        const themeResult = await query(`SELECT id FROM themes WHERE id = $1`, [theme_id]);
        if (themeResult.rows.length === 0) return res.status(400).json({ error: 'Invalid theme.' });

        const result = await query(
            `UPDATE tenants SET theme_id = $1 WHERE slug = $2 RETURNING id, slug, theme_id`,
            [theme_id, req.params.slug]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Tenant not found.' });

        // Optionally seed services if explicitly requested
        if (seed_services) {
            await seedStarterServices(result.rows[0].id, theme_id);
        }

        invalidateTenantCache(req.params.slug);
        res.json({ success: true, tenant: result.rows[0], message: 'Theme applied successfully.'});
    } catch (err) {
        console.error('[Tenants/Theme]', err.message);
        res.status(500).json({ error: 'Failed to update tenant theme.' });
    }
});

// PATCH /api/v1/tenants/:slug/slug — Update tenant slug (editable later)
router.patch('/:slug/slug', authenticate, async (req, res) => {
    if (req.tenant.slug !== req.params.slug) {
        return res.status(403).json({ error: 'Unauthorized to change slug for this tenant.' });
    }

    const { new_slug } = req.body;
    if (!new_slug) return res.status(400).json({ error: 'new_slug is required.' });

    const slugRegex = /^[a-z0-9-]{2,50}$/;
    if (!slugRegex.test(new_slug)) {
        return res.status(400).json({ error: 'Slug must be 2-50 lowercase alphanumeric characters or hyphens.' });
    }
    
    if (RESERVED_SLUGS.has(new_slug)) {
        return res.status(400).json({ error: 'This booking link is reserved and cannot be used.' });
    }

    try {
        await query('BEGIN');
        
        await query(
            `INSERT INTO tenant_slug_history (tenant_id, old_slug) VALUES ($1, $2)`,
            [req.tenant.id, req.params.slug]
        );

        const result = await query(
            `UPDATE tenants SET slug = $1 WHERE slug = $2 RETURNING id, slug`,
            [new_slug, req.params.slug]
        );
        if (result.rows.length === 0) {
            await query('ROLLBACK');
            return res.status(404).json({ error: 'Tenant not found.' });
        }
        
        await query('COMMIT');

        invalidateTenantCache(req.params.slug); // invalidate old
        
        res.json({ success: true, tenant: result.rows[0], message: 'Booking link updated successfully.' });
    } catch (err) {
        await query('ROLLBACK');
        if (err.code === '23505') {
            return res.status(409).json({ error: `The booking link "${new_slug}" is already taken.` });
        }
        console.error('[Tenants/Slug Update]', err.message);
        res.status(500).json({ error: 'Failed to update booking link.' });
    }
});

module.exports = router;
