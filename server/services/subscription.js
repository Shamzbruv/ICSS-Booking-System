/**
 * Subscription & Feature Flag Service
 *
 * Enforces plan limits and feature entitlements per tenant.
 * All enforcement logic lives here — routes just call these helpers.
 */

const { query } = require('../db/connection');

/**
 * Check if a feature is enabled for the given tenant.
 * Tenant-level overrides take precedence over plan defaults.
 *
 * @param {Object} tenant - req.tenant (includes resolvedFeatures)
 * @param {string} feature - Feature key (e.g. 'designInquiries', 'dhlShipping')
 * @returns {boolean}
 */
function featureEnabled(tenant, feature) {
    if (!tenant?.resolvedFeatures) return false;
    return tenant.resolvedFeatures[feature] === true;
}

/**
 * Get the monthly booking limit for a tenant.
 * -1 = unlimited (Enterprise).
 */
function getBookingLimit(tenant) {
    const limit = tenant?.resolvedLimits?.bookings_per_month;
    return typeof limit === 'number' ? limit : 50; // Default to starter limit
}

/**
 * Count the current tenant's confirmed bookings this calendar month.
 * @returns {Promise<number>}
 */
async function getMonthlyBookingCount(tenantId) {
    const result = await query(
        `SELECT COUNT(*) AS count FROM bookings
         WHERE tenant_id = $1
           AND status = 'confirmed'
           AND booking_date >= date_trunc('month', NOW())
           AND booking_date <  date_trunc('month', NOW()) + INTERVAL '1 month'`,
        [tenantId]
    );
    return parseInt(result.rows[0]?.count || '0', 10);
}

/**
 * Middleware factory: Enforce booking limit before allowing a new booking.
 * Call as a route middleware: router.post('/bookings', enforceBookingLimit, handler)
 */
function enforceBookingLimit(req, res, next) {
    const enforce = process.env.ENABLE_SUBSCRIPTION_ENFORCEMENT === 'true';
    if (!enforce) return next(); // Skip enforcement in dev

    const tenant = req.tenant;
    const limit  = getBookingLimit(tenant);

    if (limit === -1) return next(); // Unlimited plan

    getMonthlyBookingCount(tenant.id).then(count => {
        if (count >= limit) {
            return res.status(402).json({
                error: `Monthly booking limit of ${limit} reached for your ${tenant.plan_id} plan. Please upgrade to continue.`,
                upgrade_url: `/admin/billing`
            });
        }
        next();
    }).catch(err => {
        console.error('[SubscriptionEnforcer] Error checking limit:', err.message);
        next(); // Fail open (don't block bookings on internal error)
    });
}

/**
 * Middleware factory: Guard a route by feature flag.
 * Usage: router.post('/design/submit', requireFeature('designInquiries'), handler)
 */
function requireFeature(feature) {
    return (req, res, next) => {
        if (!featureEnabled(req.tenant, feature)) {
            return res.status(403).json({
                error: `The "${feature}" feature is not available on your current plan.`,
                upgrade_url: `/admin/billing`
            });
        }
        next();
    };
}

module.exports = { featureEnabled, getBookingLimit, getMonthlyBookingCount, enforceBookingLimit, requireFeature };
