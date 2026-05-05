const DEFAULT_PAYPAL_TRIAL_PLAN_ID = 'P-4EC410252Y479773KNHUVB4A';
const DEFAULT_TRIAL_DAYS = 7;
const DEFAULT_MONTHLY_PRICE_USD = 35.50;
const VALID_INTERNAL_PLAN_IDS = new Set(['starter', 'pro', 'enterprise']);

function getPayPalSignupConfig() {
    const configuredPlanId = String(
        process.env.PAYPAL_PLAN_ID ||
        process.env.PAYPAL_TRIAL_PLAN_ID ||
        DEFAULT_PAYPAL_TRIAL_PLAN_ID
    ).trim();

    const configuredClientId = String(process.env.PAYPAL_CLIENT_ID || 'sb').trim();
    const trialDays = Number(process.env.PAYPAL_TRIAL_DAYS || DEFAULT_TRIAL_DAYS);
    const monthlyPrice = Number(process.env.PAYPAL_MONTHLY_PRICE_USD || DEFAULT_MONTHLY_PRICE_USD);

    return {
        planId: configuredPlanId || DEFAULT_PAYPAL_TRIAL_PLAN_ID,
        clientId: configuredClientId || 'sb',
        trialDays: Number.isFinite(trialDays) && trialDays > 0 ? trialDays : DEFAULT_TRIAL_DAYS,
        monthlyPriceUsd: Number.isFinite(monthlyPrice) && monthlyPrice > 0 ? monthlyPrice : DEFAULT_MONTHLY_PRICE_USD,
        internalPlanId: 'starter'
    };
}

function normalizeInternalSignupPlanId(planId) {
    const normalized = String(planId || '').trim().toLowerCase();
    if (normalized === 'trial' || normalized === 'monthly') {
        return 'starter';
    }
    if (VALID_INTERNAL_PLAN_IDS.has(normalized)) {
        return normalized;
    }
    return 'starter';
}

function isConfiguredTrialPlan(planId) {
    if (!planId) return false;
    return String(planId).trim() === getPayPalSignupConfig().planId;
}

module.exports = {
    getPayPalSignupConfig,
    normalizeInternalSignupPlanId,
    isConfiguredTrialPlan
};
