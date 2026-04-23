/**
 * JWT Auth Middleware + RBAC
 *
 * authenticate(req, res, next)        — Verifies JWT, attaches req.user
 * requireRole(...roles)               — Factory: role-check middleware
 * requirePlatformOwner                — Shorthand for platform_owner only
 * requireWriteAccess(req, res, next)  — Rejects writes during read-only impersonation
 *
 * Role hierarchy (highest → lowest):
 *   platform_owner — ICSS platform owner (this account; full system access)
 *   super_admin    — ICSS platform staff (can manage tenants)
 *   tenant_admin   — Admin of a specific tenant account
 *   staff          — Staff member of a tenant
 *   customer       — End user / booking customer
 */

const jwt = require('jsonwebtoken');
const { query } = require('../db/connection');

const JWT_SECRET  = process.env.JWT_SECRET  || 'dev_secret_change_in_production';
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '7d';

const ROLE_LEVELS = {
    customer:       1,
    staff:          2,
    tenant_admin:   3,
    super_admin:    4,
    platform_owner: 5,
};

/**
 * Verifies the Bearer JWT in the Authorization header.
 * On success: attaches req.user = { id, email, role, tenant_id, ... }
 *
 * If the token contains impersonation claims, verifies the session is
 * still active in DB and attaches req.impersonation.
 */
async function authenticate(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization header required (Bearer token).' });
    }

    const token = authHeader.slice(7);

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;

        // ── Impersonation session validation ──────────────────────────────────
        if (decoded.impersonation_session_id) {
            const sesRes = await query(
                `SELECT id, mode, actor_user_id, target_tenant_id
                 FROM impersonation_sessions
                 WHERE id = $1
                   AND revoked_at IS NULL
                   AND expires_at > NOW()`,
                [decoded.impersonation_session_id]
            );
            if (sesRes.rows.length === 0) {
                return res.status(401).json({ error: 'Impersonation session expired or revoked.' });
            }
            req.impersonation = sesRes.rows[0];
        }

        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token has expired. Please log in again.' });
        }
        return res.status(401).json({ error: 'Invalid or malformed token.' });
    }
}

/**
 * Returns middleware that checks req.user.role against the allowed roles.
 * Usage: router.get('/admin', authenticate, requireRole('tenant_admin', 'super_admin'), handler)
 *
 * platform_owner bypasses cross-tenant checks.
 */
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required.' });
        }

        // platform_owner has universal access — never blocked by tenant checks
        if (req.user.role === 'platform_owner') {
            return next();
        }

        // Ensure tenant admin can only access their own tenant's data
        if (req.tenant && req.user.tenant_id && req.user.role !== 'super_admin') {
            if (req.user.tenant_id !== req.tenant.id) {
                return res.status(403).json({ error: 'Access denied: Cross-tenant request rejected.' });
            }
        }

        const userLevel = ROLE_LEVELS[req.user.role] || 0;
        const hasPermission = roles.some(role => {
            const requiredLevel = ROLE_LEVELS[role] || 0;
            return userLevel >= requiredLevel;
        });

        if (!hasPermission) {
            return res.status(403).json({
                error: `Access denied. Required role: ${roles.join(' or ')}.`
            });
        }

        next();
    };
}

/**
 * Middleware: only platform_owner may proceed.
 */
function requirePlatformOwner(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required.' });
    }
    if (req.user.role !== 'platform_owner') {
        return res.status(403).json({ error: 'Platform Owner access required.' });
    }
    next();
}

/**
 * Middleware: rejects mutating requests during read-only impersonation.
 * Place after authenticate on any route that writes data.
 */
function requireWriteAccess(req, res, next) {
    if (req.impersonation && req.impersonation.mode === 'read_only') {
        return res.status(403).json({
            error: 'This session is read-only. Enable Edit Mode in the Platform Console to make changes.',
            impersonation_mode: 'read_only',
        });
    }
    next();
}

/**
 * Generate a signed JWT for a user.
 */
function signToken(payload, expiresIn) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: expiresIn || JWT_EXPIRES });
}

/**
 * Optional auth — attaches req.user if a valid token is present,
 * but does NOT block the request if no token is provided.
 */
function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
        return next();
    }
    const token = authHeader.slice(7);
    try {
        req.user = jwt.verify(token, JWT_SECRET);
    } catch {
        // Ignore invalid token — treat as unauthenticated
    }
    next();
}

module.exports = { authenticate, requireRole, requirePlatformOwner, requireWriteAccess, signToken, optionalAuth };
