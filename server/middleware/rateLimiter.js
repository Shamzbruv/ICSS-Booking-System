/**
 * Rate Limiter Middleware
 * Separate verified admin, public read and public write budgets to prevent abuse.
 */

const rateLimit = require('express-rate-limit');

const jwt = require('jsonwebtoken');
const { ipKeyGenerator } = rateLimit;
const ADMIN_ROLES = new Set(['staff', 'tenant_admin', 'super_admin', 'developer_admin', 'platform_owner']);

// Verify the signature before granting an account its own budget. Never use a
// caller-supplied tenant header or an unverified token as a rate-limit key.
function adminIdentity(req) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return null;
    try {
        const user = jwt.verify(header.slice(7), process.env.JWT_SECRET || 'dev_secret_change_in_production');
        return user.id && ADMIN_ROLES.has(user.role)
            ? `${user.tenant_id || 'platform'}:${user.id}` : null;
    } catch { return null; }
}

function createApiRateLimiter({ readMax = 600, writeMax = 200, adminMax = 1200 } = {}) {
    const common = {
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Too many requests. Please slow down and try again later.' }
    };
    // Website reads and booking writes have separate budgets, so preview loads
    // cannot consume the allowance needed to submit a customer's booking.
    const reads = rateLimit({ ...common, windowMs: 5 * 60 * 1000, max: readMax });
    const writes = rateLimit({ ...common, windowMs: 15 * 60 * 1000, max: writeMax });
    const admins = rateLimit({
        ...common, windowMs: 15 * 60 * 1000, max: adminMax,
        keyGenerator: req => req.rateLimitAdminId || ipKeyGenerator(req.ip)
    });
    return (req, res, next) => {
        const identity = adminIdentity(req);
        if (identity) {
            req.rateLimitAdminId = identity;
            return admins(req, res, next);
        }
        return (['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? reads : writes)(req, res, next);
    };
}

const rateLimiter = createApiRateLimiter();

// Stricter limit for payment endpoints to prevent brute force
const paymentLimiter = rateLimit({
    windowMs: 60 * 1000,  // 1 minute
    max: 10,
    message: { error: 'Too many payment requests. Please wait before retrying.' }
});

// Stricter limit for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Too many login attempts. Please wait 15 minutes.' }
});

module.exports = { rateLimiter, paymentLimiter, authLimiter, createApiRateLimiter };
