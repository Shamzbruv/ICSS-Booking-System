/**
 * Subscription & Feature Flag Service
 *
 * Enforces plan limits and feature entitlements per tenant.
 * All enforcement logic lives here — routes just call these helpers.
 */

const { query } = require('../db/connection');
const { logAudit } = require('./audit');
const { isConfiguredTrialPlan } = require('./paypalConfig');

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
 * Middleware factory: Enforce booking limit and payment statuses before allowing a new booking.
 */
function enforceBookingLimit(req, res, next) {
    const enforce = process.env.ENABLE_SUBSCRIPTION_ENFORCEMENT === 'true';
    if (!enforce) return next();

    const tenant = req.tenant;
    
    // Validate trial/paid/expired lifecycle
    const status = tenant.subscription_status || 'trial';
    if (status === 'expired' || status === 'canceled') {
        return res.status(402).json({
            error: `Your subscription has expired or was canceled. Please update your billing details.`,
            upgrade_url: `/admin/billing`
        });
    }

    const limit  = getBookingLimit(tenant);

    if (limit === -1) return next();

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
        next();
    });
}

/**
 * Handle Stripe Webhook Events
 */
async function handleStripeWebhookEvent(event) {
    try {
        const obj = event.data.object;
        switch (event.type) {
            case 'customer.subscription.created':
            case 'customer.subscription.updated':
                const customerId = obj.customer;
                const subId = obj.id;
                const status = obj.status; // e.g. 'active', 'past_due', 'canceled', 'unpaid'
                
                let internalStatus = 'trial';
                if (status === 'active' || status === 'trialing') internalStatus = 'paid';
                if (status === 'canceled' || status === 'unpaid') internalStatus = 'canceled';
                if (status === 'past_due') internalStatus = 'expired';

                await query(
                    `UPDATE tenants SET subscription_status = $1, stripe_subscription_id = $2 WHERE stripe_customer_id = $3`,
                    [internalStatus, subId, customerId]
                );
                // Audit the subscription state change
                const tRes = await query(`SELECT id FROM tenants WHERE stripe_customer_id = $1`, [customerId]);
                if (tRes.rows.length > 0) {
                    await logAudit({
                        tenantId: tRes.rows[0].id,
                        action: `subscription.${internalStatus}`,
                        entity: 'tenant',
                        entityId: tRes.rows[0].id,
                        metadata: { provider: 'stripe', stripeSubId: subId, status: internalStatus, stripeEventType: event.type }
                    });
                }
                console.log(`[Stripe Sync] Updated tenant for customer ${customerId} to ${internalStatus}`);
                break;
            case 'customer.subscription.deleted':
                await query(
                    `UPDATE tenants SET subscription_status = 'canceled' WHERE stripe_subscription_id = $1`,
                    [obj.id]
                );
                console.log(`[Stripe Sync] Canceled subscription ${obj.id}`);
                break;
        }
    } catch (e) {
        console.error('[Stripe Webhook Error]', e);
    }
}

/**
 * Handle PayPal Webhook Events (Main Billing System)
 */
async function handlePayPalWebhookEvent(event) {
    try {
        const resource = event.resource;
        const subId = event.event_type === 'PAYMENT.SALE.COMPLETED'
            ? (resource.billing_agreement_id || resource.id)
            : resource.id;
        const status = resource.status; // 'APPROVAL_PENDING', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED'
        const planId = resource.plan_id || null;

        let internalStatus = 'trial';
        
        switch (event.event_type) {
            case 'BILLING.SUBSCRIPTION.CREATED':
            case 'BILLING.SUBSCRIPTION.ACTIVATED':
                // PayPal sends BILLING.SUBSCRIPTION.ACTIVATED when active.
                if (status === 'ACTIVE') {
                    internalStatus = isConfiguredTrialPlan(planId) ? 'trial' : 'paid';
                }
                break;
            case 'BILLING.SUBSCRIPTION.CANCELLED':
            case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
                internalStatus = 'canceled';
                break;
            case 'BILLING.SUBSCRIPTION.EXPIRED':
            case 'BILLING.SUBSCRIPTION.SUSPENDED':
                internalStatus = 'expired';
                break;
            case 'PAYMENT.SALE.COMPLETED':
                // First successful charge after the free trial promotes the tenant to paid.
                internalStatus = 'paid';
                break;
            default:
                return;
        }

        if (!subId) {
            return;
        }

        const result = await query(
            `UPDATE tenants SET subscription_status = $1 WHERE paypal_subscription_id = $2 RETURNING id`,
            [internalStatus, subId]
        );
        if (result.rows.length > 0) {
            const tenantId = result.rows[0].id;
            console.log(`[PayPal Sync] Updated tenant ${tenantId} for subscription ${subId} to ${internalStatus}`);
            // Audit the subscription state change
            await logAudit({
                tenantId,
                action: `subscription.${internalStatus}`,
                entity: 'tenant',
                entityId: tenantId,
                metadata: { provider: 'paypal', paypalSubId: subId, status: internalStatus, paypalEventType: event.event_type }
            });
            const { invalidateTenantCache } = require('../middleware/tenantResolver');
        }
    } catch (e) {
        console.error('[PayPal Webhook Error]', e);
    }
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

module.exports = { featureEnabled, getBookingLimit, getMonthlyBookingCount, enforceBookingLimit, requireFeature, handleStripeWebhookEvent, handlePayPalWebhookEvent };
