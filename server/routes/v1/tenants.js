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

// GET /api/v1/tenants/:slug/layout — Get the current grid layout
router.get('/:slug/layout', authenticate, async (req, res) => {
    // Basic tenant check
    if (req.tenant.slug !== req.params.slug) {
        return res.status(403).json({ error: 'Unauthorized to view layout for this tenant.' });
    }
    try {
        const result = await query(`SELECT layout FROM tenants WHERE slug = $1`, [req.params.slug]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Tenant not found.' });
        res.json({ layout: result.rows[0].layout });
    } catch (err) {
        console.error('[Tenants/Layout Load]', err.message);
        res.status(500).json({ error: 'Failed to load layout.' });
    }
});

// PATCH /api/v1/tenants/:slug/layout — Save the grid layout
router.patch('/:slug/layout', authenticate, async (req, res) => {
    if (req.tenant.slug !== req.params.slug) {
        return res.status(403).json({ error: 'Unauthorized to save layout for this tenant.' });
    }
    const { layout } = req.body;
    if (!layout) return res.status(400).json({ error: 'layout array is required.' });
    
    try {
        const result = await query(
            `UPDATE tenants SET layout = $1 WHERE slug = $2 RETURNING id`,
            [JSON.stringify(layout), req.params.slug]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Tenant not found.' });
        res.json({ success: true, message: 'Layout saved successfully.' });
    } catch (err) {
        console.error('[Tenants/Layout Save]', err.message);
        res.status(500).json({ error: 'Failed to save layout.' });
    }
});

const { encrypt, maskSecret } = require('../../services/encryption');

// GET /api/v1/tenants/:slug/payment-settings
router.get('/:slug/payment-settings', authenticate, async (req, res) => {
    if (req.tenant.slug !== req.params.slug) {
        return res.status(403).json({ error: 'Unauthorized to view payment settings for this tenant.' });
    }
    
    try {
        const result = await query(
            `SELECT default_payment_mode, wipay_enabled, manual_payment_enabled, 
                    hold_timeout_minutes, bank_transfer_instructions, payment_settings, business_hours 
             FROM tenants WHERE slug = $1`, 
            [req.params.slug]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Tenant not found.' });
        
        const data = result.rows[0];
        let maskedSettings = {};
        
        if (data.payment_settings) {
            // Mask secrets
            maskedSettings = { ...data.payment_settings };
            if (maskedSettings.wipay_merchant_code) {
                maskedSettings.wipay_merchant_code = maskSecret('MASKED_SECRET', 0) + ' (Set)'; 
                // We don't want to expose length or partials of raw encrypted hashes, 
                // but just indicating it exists is safe.
            }
        }
        
        res.json({ settings: { ...data, payment_settings: maskedSettings } });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch settings.' });
    }
});

// PATCH /api/v1/tenants/:slug/payment-settings — Save the payment configuration
router.patch('/:slug/payment-settings', authenticate, async (req, res) => {
    if (req.tenant.slug !== req.params.slug) {
        return res.status(403).json({ error: 'Unauthorized to save payment settings for this tenant.' });
    }
    const { 
        default_payment_mode, wipay_enabled, manual_payment_enabled, 
        hold_timeout_minutes, bank_transfer_instructions, payment_settings, business_hours 
    } = req.body;
    
    try {
        // Fetch existing settings to preserve unmodified secrets if they come back masked
        const currentRes = await query(`SELECT payment_settings FROM tenants WHERE slug = $1`, [req.params.slug]);
        let existingSettings = currentRes.rows[0]?.payment_settings || {};
        
        let newSettings = { ...existingSettings };
        
        if (payment_settings) {
            if (payment_settings.wipay_merchant_code && !payment_settings.wipay_merchant_code.includes('(Set)')) {
                newSettings.wipay_merchant_code = encrypt(payment_settings.wipay_merchant_code);
            }
            if (payment_settings.wipay_account_id) {
                newSettings.wipay_account_id = payment_settings.wipay_account_id; // Usually public/non-secret, but can encrypt if needed
            }
        }

        const result = await query(
            `UPDATE tenants 
             SET default_payment_mode = COALESCE($1, default_payment_mode),
                 wipay_enabled = COALESCE($2, wipay_enabled),
                 manual_payment_enabled = COALESCE($3, manual_payment_enabled),
                 hold_timeout_minutes = COALESCE($4, hold_timeout_minutes),
                 bank_transfer_instructions = COALESCE($5, bank_transfer_instructions),
                 payment_settings = $6,
                 business_hours = COALESCE($7, business_hours)
             WHERE slug = $8 RETURNING id`,
            [
                default_payment_mode, 
                wipay_enabled !== undefined ? Boolean(wipay_enabled) : null,
                manual_payment_enabled !== undefined ? Boolean(manual_payment_enabled) : null,
                hold_timeout_minutes ? parseInt(hold_timeout_minutes) : null,
                bank_transfer_instructions,
                JSON.stringify(newSettings),
                business_hours ? JSON.stringify(business_hours) : null,
                req.params.slug
            ]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Tenant not found.' });
        res.json({ success: true, message: 'Payment settings saved successfully.' });
    } catch (err) {
        console.error('[Tenants/Payment Settings]', err.message);
        res.status(500).json({ error: 'Failed to save payment settings.' });
    }
});

// PATCH /api/v1/tenants/:slug/branding — Save booking-page branding (logo, tagline, etc.)
router.patch('/:slug/branding', authenticate, async (req, res) => {
    if (req.tenant.slug !== req.params.slug && req.user.role !== 'platform_owner' && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Unauthorized to update branding for this tenant.' });
    }
    const {
        logoUrl,
        bookingTagline,
        location,
        accentColor,
        primaryColor,
        badge1,
        badge2,
        timezone,
        stylists,
        bookingFooterNote,
    } = req.body;

    try {
        // Fetch existing branding to deep-merge
        const cur = await query(`SELECT branding FROM tenants WHERE slug = $1`, [req.params.slug]);
        if (cur.rows.length === 0) return res.status(404).json({ error: 'Tenant not found.' });
        const existing = cur.rows[0].branding || {};

        const merged = {
            ...existing,
            ...(logoUrl        !== undefined && { logoUrl }),
            ...(bookingTagline !== undefined && { bookingTagline }),
            ...(location       !== undefined && { location }),
            ...(accentColor    !== undefined && { accentColor }),
            ...(primaryColor   !== undefined && { primaryColor }),
            ...(badge1         !== undefined && { badge1 }),
            ...(badge2         !== undefined && { badge2 }),
            ...(timezone       !== undefined && { timezone }),
            ...(Array.isArray(stylists)       && { stylists }),
            ...(bookingFooterNote !== undefined && { bookingFooterNote }),
        };

        await query(
            `UPDATE tenants SET branding = $1 WHERE slug = $2`,
            [JSON.stringify(merged), req.params.slug]
        );

        invalidateTenantCache(req.params.slug);
        res.json({ success: true, branding: merged });
    } catch (err) {
        console.error('[Tenants/Branding]', err.message);
        res.status(500).json({ error: 'Failed to save branding.' });
    }
});

module.exports = router;
