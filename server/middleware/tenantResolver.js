/**
 * Tenant Resolver Middleware
 *
 * Resolves the current tenant from the incoming request via:
 * 1. X-Tenant-ID header (highest priority — for API clients & testing)
 * 2. Subdomain (e.g. windross.icss.app → slug = "windross")
 * 3. JWT claim (tenant_id embedded in auth token by the login flow)
 *
 * On success, injects `req.tenant` = { id, slug, name, plan_id, features, limits, branding }
 * On failure, returns 401 Unauthorized.
 *
 * IMPORTANT: Every DB query in routes must include WHERE tenant_id = $N
 * using req.tenant.id to enforce data isolation.
 */

const { query } = require('../db/connection');

// In-memory tenant cache to avoid a DB hit on every request.
// Invalidated every 5 minutes to pick up plan changes.
const tenantCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

async function resolveTenantBySlug(slug) {
    const cached = tenantCache.get(slug);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
        return cached.tenant;
    }

    const result = await query(
        `SELECT t.*, p.features AS plan_features, p.limits AS plan_limits
         FROM tenants t
         LEFT JOIN plans p ON t.plan_id = p.id
         WHERE t.slug = $1 AND t.active = true`,
        [slug]
    );

    if (result.rows.length === 0) return null;

    const tenant = result.rows[0];
    // Merge plan features/limits with any tenant-level overrides
    tenant.resolvedFeatures = { ...tenant.plan_features, ...tenant.features };
    tenant.resolvedLimits   = { ...tenant.plan_limits,   ...tenant.limits   };

    tenantCache.set(slug, { tenant, ts: Date.now() });
    return tenant;
}

async function resolveTenantById(id) {
    // Check cache by id too
    for (const [, entry] of tenantCache) {
        if (entry.tenant.id === id && Date.now() - entry.ts < CACHE_TTL_MS) {
            return entry.tenant;
        }
    }

    const result = await query(
        `SELECT t.*, p.features AS plan_features, p.limits AS plan_limits
         FROM tenants t
         LEFT JOIN plans p ON t.plan_id = p.id
         WHERE t.id = $1 AND t.active = true`,
        [id]
    );
    if (result.rows.length === 0) return null;

    const tenant = result.rows[0];
    tenant.resolvedFeatures = { ...tenant.plan_features, ...tenant.features };
    tenant.resolvedLimits   = { ...tenant.plan_limits,   ...tenant.limits   };
    return tenant;
}

/**
 * Extract tenant slug from the host header.
 * windross.icss.app       → "windross"
 * localhost:3000          → null (dev — use X-Tenant-ID instead)
 * icss.app                → null (root domain, not a tenant)
 */
function extractSlugFromHost(host) {
    if (!host) return null;
    const parts = host.split('.');
    // Expect at least subdomain.domain.tld (3 parts)
    if (parts.length >= 3) {
        return parts[0].toLowerCase();
    }
    return null;
}

/**
 * Main middleware — resolves tenant and attaches to req.tenant.
 * Routes that do NOT need a tenant context (e.g. POST /api/v1/tenants to register)
 * should skip this middleware by being mounted before it or using a bypass flag.
 */
async function tenantResolver(req, res, next) {
    // ── Special bypass for tenant provisioning endpoint ───────────────────────
    // Allow unauthenticated tenant creation (the endpoint itself validates an admin key)
    if (req.path === '/tenants' && req.method === 'POST') {
        return next();
    }

    // Also skip for auth routes (login doesn't have a tenant yet)
    if (req.path.startsWith('/auth/')) {
        return next();
    }

    // Skip calendar callbacks, webhooks, and private feeds
    if (req.path.startsWith('/calendar/oauth2callback') || 
        req.path.startsWith('/calendar/webhook') || 
        req.path.startsWith('/calendar/feed') ||
        req.path.startsWith('/payments/stripe/webhook') ||
        req.path.startsWith('/payments/paypal/webhook') ||
        req.path === '/payments/paypal/create-subscription' ||
        req.path.startsWith('/themes') ||
        req.path.startsWith('/public/provisioning-status')) {
        return next();
    }

    try {
        let tenant = null;

        // 1. X-Tenant-ID header (UUID)
        const headerTenantId = req.headers['x-tenant-id'];
        if (headerTenantId) {
            tenant = await resolveTenantById(headerTenantId);
        }

        // 2. X-Tenant-Slug header (slug string)
        if (!tenant) {
            const headerSlug = req.headers['x-tenant-slug'];
            if (headerSlug) {
                tenant = await resolveTenantBySlug(headerSlug);
            }
        }

        // 3. Subdomain extraction from Host header
        if (!tenant) {
            const slug = extractSlugFromHost(req.headers.host);
            if (slug) {
                tenant = await resolveTenantBySlug(slug);
            }
        }

        // 4. JWT claim (if auth middleware has already run and set req.user)
        if (!tenant && req.user?.tenant_id) {
            tenant = await resolveTenantById(req.user.tenant_id);
        }

        if (!tenant) {
            return res.status(401).json({
                error: 'Tenant not identified. Provide X-Tenant-ID header or use a valid subdomain.'
            });
        }

        req.tenant = tenant;
        next();

    } catch (err) {
        console.error('[TenantResolver] Error:', err.message);
        res.status(500).json({ error: 'Failed to resolve tenant context.' });
    }
}

/**
 * Invalidate a specific tenant from the cache (call after plan changes).
 */
function invalidateTenantCache(slug) {
    tenantCache.delete(slug);
}

module.exports = { tenantResolver, invalidateTenantCache };
