/**
 * JWT Auth Middleware + RBAC
 *
 * authenticate(req, res, next)   — Verifies JWT and attaches req.user
 * requireRole(...roles)          — Factory that returns role-check middleware
 *
 * Role hierarchy (highest → lowest):
 *   super_admin  — ICSS platform staff (can manage tenants)
 *   tenant_admin — Admin of a specific tenant account
 *   staff        — Staff member of a tenant
 *   customer     — End user / booking customer
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET  = process.env.JWT_SECRET  || 'dev_secret_change_in_production';
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '7d';

const ROLE_LEVELS = {
    customer:     1,
    staff:        2,
    tenant_admin: 3,
    super_admin:  4
};

/**
 * Verifies the Bearer JWT in the Authorization header.
 * On success: attaches req.user = { id, email, role, tenant_id, ... }
 * On failure: 401 Unauthorized
 */
function authenticate(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization header required (Bearer token).' });
    }

    const token = authHeader.slice(7);

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
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
 * Usage: router.get('/admin/bookings', authenticate, requireRole('tenant_admin', 'super_admin'), handler)
 */
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required.' });
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
 * Generate a signed JWT for a user.
 * Called from the auth route after login / registration.
 */
function signToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

/**
 * Optional auth — attaches req.user if a valid token is present,
 * but does NOT block the request if no token is provided.
 * Useful for public routes that behave differently for logged-in users.
 */
function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
        return next(); // Continue without user
    }
    const token = authHeader.slice(7);
    try {
        req.user = jwt.verify(token, JWT_SECRET);
    } catch {
        // Ignore invalid token — treat as unauthenticated
    }
    next();
}

module.exports = { authenticate, requireRole, signToken, optionalAuth };
