/**
 * Payment Gateway Catalog
 *
 * Every tenant-facing payment option is "pre-wired" here. A tenant activates a
 * gateway by pasting the details from their own merchant profile (a hosted
 * payment link, or a wallet handle) in Admin → Settings → Payment Gateways.
 * No platform-level API keys are required, so a tenant can be live in minutes.
 *
 * Two kinds of gateway exist:
 *   - 'link'    → the customer is sent to the tenant's hosted checkout page
 *                 (amount + booking reference pre-filled where supported).
 *                 The booking stays `pending_payment` until the tenant verifies it.
 *   - 'receipt' → the customer pays outside the site (wallet / bank) and uploads
 *                 a screenshot. The booking stays `pending_manual_confirmation`.
 *
 * PayPal and bank transfer keep their original dedicated columns
 * (paypal_payment_link / manual_payment_enabled) for backwards compatibility.
 * The newer gateways live in tenants.payment_settings.gateways.<key>.
 */

const GATEWAYS = {
    paypal: {
        key: 'paypal',
        label: 'PayPal',
        kind: 'link',
        legacy: true,
        currency: 'USD',
        summary: 'International cards and PayPal balances. Amounts are converted to USD automatically.'
    },
    fygaro: {
        key: 'fygaro',
        label: 'Fygaro',
        kind: 'link',
        linkHosts: ['fygaro.com'],
        defaultAmountParam: 'amount',
        defaultReferenceParam: 'client_note',
        summary: 'Caribbean card payments (Visa / Mastercard) through a Fygaro payment link.'
    },
    easypay: {
        key: 'easypay',
        label: 'EasyPay',
        kind: 'link',
        defaultAmountParam: 'amount',
        defaultReferenceParam: 'reference',
        summary: 'Card payments through your EasyPay hosted checkout or payment link.'
    },
    fac: {
        key: 'fac',
        label: 'First Atlantic Commerce / PowerTranz',
        kind: 'link',
        defaultAmountParam: '',
        defaultReferenceParam: '',
        summary: 'Bank-grade card processing (NCB / FAC) through a hosted payment page link.'
    },
    lynk: {
        key: 'lynk',
        label: 'Lynk',
        kind: 'receipt',
        summary: 'Jamaica’s mobile wallet. Customers send the payment to your Lynk handle and upload the confirmation.'
    },
    manual: {
        key: 'manual',
        label: 'Bank Transfer',
        kind: 'receipt',
        legacy: true,
        summary: 'Customers transfer to your bank account and upload the receipt.'
    }
};

/** Gateways stored inside payment_settings.gateways (not legacy columns). */
const MODERN_GATEWAY_KEYS = Object.keys(GATEWAYS).filter((key) => !GATEWAYS[key].legacy);
const PAYMENT_MODES = ['none', ...Object.keys(GATEWAYS)];
const SERVICE_PAYMENT_MODES = ['tenant_default', ...PAYMENT_MODES];

function getGateway(key) {
    return GATEWAYS[key] || null;
}

function isLinkGateway(mode) {
    return GATEWAYS[mode]?.kind === 'link';
}

function isReceiptGateway(mode) {
    return GATEWAYS[mode]?.kind === 'receipt';
}

function readGatewaySettings(tenant, key) {
    const settings = tenant?.payment_settings || {};
    const gateways = settings.gateways || {};
    return gateways[key] || {};
}

/** True when the tenant has switched a gateway on AND supplied what it needs. */
function isGatewayEnabled(tenant, key) {
    if (!tenant) return false;
    if (key === 'paypal') return Boolean(tenant.paypal_payments_enabled && tenant.paypal_payment_link);
    if (key === 'manual') return Boolean(tenant.manual_payment_enabled);
    const gateway = GATEWAYS[key];
    if (!gateway) return false;
    const config = readGatewaySettings(tenant, key);
    if (!config.enabled) return false;
    if (gateway.kind === 'link') return Boolean(config.link);
    if (gateway.kind === 'receipt') return Boolean(config.handle);
    return false;
}

function cleanString(value, max = 300) {
    return String(value ?? '').trim().slice(0, max);
}

function isSafeHttpsUrl(value) {
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

function hostMatches(url, hosts) {
    if (!hosts || hosts.length === 0) return true;
    try {
        const host = new URL(url).hostname.toLowerCase();
        return hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
    } catch {
        return false;
    }
}

/**
 * Validate + normalise the gateway block submitted from the settings page.
 * Returns { gateways } or throws an Error with a user-facing message.
 */
function normalizeGatewaySettings(input = {}, existing = {}) {
    const result = { ...existing };

    for (const key of MODERN_GATEWAY_KEYS) {
        if (input[key] === undefined) continue;
        const gateway = GATEWAYS[key];
        const raw = input[key] || {};
        const next = {
            enabled: Boolean(raw.enabled),
            instructions: cleanString(raw.instructions, 600)
        };

        if (gateway.kind === 'link') {
            const link = cleanString(raw.link, 500);
            if (link && !isSafeHttpsUrl(link)) {
                throw new Error(`${gateway.label}: the payment link must start with https://`);
            }
            if (link && !hostMatches(link, gateway.linkHosts)) {
                throw new Error(`${gateway.label}: paste the payment link from your ${gateway.label} dashboard (it should be on ${gateway.linkHosts.join(' or ')}).`);
            }
            const paramPattern = /^[A-Za-z0-9_.-]{0,40}$/;
            const amountParam = raw.amountParam === undefined ? gateway.defaultAmountParam : cleanString(raw.amountParam, 40);
            const referenceParam = raw.referenceParam === undefined ? gateway.defaultReferenceParam : cleanString(raw.referenceParam, 40);
            if (!paramPattern.test(amountParam) || !paramPattern.test(referenceParam)) {
                throw new Error(`${gateway.label}: URL parameter names may only contain letters, numbers, dots, dashes and underscores.`);
            }
            next.link = link;
            next.amountParam = amountParam;
            next.referenceParam = referenceParam;
            next.merchantId = cleanString(raw.merchantId, 120);
            if (next.enabled && !link) {
                throw new Error(`${gateway.label}: add your payment link before enabling it.`);
            }
        } else if (gateway.kind === 'receipt') {
            const handle = cleanString(raw.handle, 80);
            if (handle && !/^@?[A-Za-z0-9._-]{2,60}$/.test(handle)) {
                throw new Error(`${gateway.label}: enter your handle, for example @yourbusiness.`);
            }
            next.handle = handle ? (handle.startsWith('@') ? handle : `@${handle}`) : '';
            next.accountName = cleanString(raw.accountName, 120);
            if (next.enabled && !next.handle) {
                throw new Error(`${gateway.label}: add your ${gateway.label} handle before enabling it.`);
            }
        }

        result[key] = next;
    }

    return result;
}

/** Build the hosted checkout URL for a link gateway. */
function buildCheckoutUrl(tenant, mode, { amount, currency, reference }) {
    const config = readGatewaySettings(tenant, mode);
    if (!config.link) return null;
    let url;
    try {
        url = new URL(config.link);
    } catch {
        return null;
    }
    const amountValue = Number(amount || 0).toFixed(2);
    if (config.amountParam) url.searchParams.set(config.amountParam, amountValue);
    if (config.referenceParam && reference) url.searchParams.set(config.referenceParam, reference);
    if (currency && config.amountParam && !url.searchParams.has('currency')) {
        // Most hosted pages ignore unknown params; passing currency helps the ones that read it.
        url.searchParams.set('currency', String(currency).toUpperCase());
    }
    return url.toString();
}

/**
 * Safe, public subset for the booking page. Never exposes merchant ids or links
 * (the server builds checkout URLs), only what a customer needs to see.
 */
function publicGatewaySummary(tenant) {
    const summary = {};
    for (const key of Object.keys(GATEWAYS)) {
        const gateway = GATEWAYS[key];
        const enabled = isGatewayEnabled(tenant, key);
        const entry = { key, label: gateway.label, kind: gateway.kind, enabled };
        if (enabled && !gateway.legacy) {
            const config = readGatewaySettings(tenant, key);
            if (config.instructions) entry.instructions = config.instructions;
            if (gateway.kind === 'receipt') {
                entry.handle = config.handle;
                if (config.accountName) entry.accountName = config.accountName;
            }
        }
        summary[key] = entry;
    }
    return summary;
}

module.exports = {
    GATEWAYS,
    MODERN_GATEWAY_KEYS,
    PAYMENT_MODES,
    SERVICE_PAYMENT_MODES,
    getGateway,
    isLinkGateway,
    isReceiptGateway,
    isGatewayEnabled,
    readGatewaySettings,
    normalizeGatewaySettings,
    buildCheckoutUrl,
    publicGatewaySummary
};
