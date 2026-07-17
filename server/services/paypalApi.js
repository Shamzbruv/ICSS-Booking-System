const axios = require('axios');

function apiBase() {
    return process.env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

function requireCredentials() {
    const clientId = String(process.env.PAYPAL_CLIENT_ID || '').trim();
    const secret = String(process.env.PAYPAL_SECRET || '').trim();
    if (!clientId || !secret) throw Object.assign(new Error('PayPal API credentials are not configured.'), { status:503 });
    return { clientId, secret };
}

async function accessToken() {
    const { clientId, secret } = requireCredentials();
    const response = await axios.post(`${apiBase()}/v1/oauth2/token`, 'grant_type=client_credentials', {
        auth: { username:clientId, password:secret },
        headers: { 'Content-Type':'application/x-www-form-urlencoded', Accept:'application/json' }, timeout:15000,
    });
    if (!response.data?.access_token) throw new Error('PayPal did not return an access token.');
    return response.data.access_token;
}

async function getSubscription(subscriptionId) {
    if (!/^I-[A-Z0-9]+$/i.test(String(subscriptionId || ''))) throw Object.assign(new Error('Invalid PayPal subscription ID.'), { status:400 });
    const token = await accessToken();
    const response = await axios.get(`${apiBase()}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`, {
        headers: { Authorization:`Bearer ${token}`, Accept:'application/json' }, timeout:15000,
    });
    return response.data;
}

async function verifySignupSubscription({ subscriptionId, signupToken, expectedPlanId }) {
    const subscription = await getSubscription(subscriptionId);
    if (subscription.id !== subscriptionId) throw Object.assign(new Error('PayPal subscription identity mismatch.'), { status:400 });
    if (subscription.custom_id !== signupToken) throw Object.assign(new Error('PayPal subscription is not linked to this signup.'), { status:400 });
    if (subscription.plan_id !== expectedPlanId) throw Object.assign(new Error('PayPal subscription plan does not match checkout.'), { status:400 });
    if (!['ACTIVE','APPROVED'].includes(subscription.status)) throw Object.assign(new Error(`PayPal subscription is not active (${subscription.status || 'unknown'}).`), { status:409 });
    return subscription;
}

module.exports = { getSubscription, verifySignupSubscription, requireCredentials };
