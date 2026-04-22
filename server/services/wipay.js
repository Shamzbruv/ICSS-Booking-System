/**
 * WiPay Integration Layer
 * Handles the generation of payment requests and verification of WiPay callbacks.
 */

const crypto = require('crypto');
const { query } = require('../db/connection');
const { decrypt } = require('./encryption');

/**
 * Generate a WiPay checkout URL.
 * 
 * @param {Object} tenant The resolved tenant object (containing payment_settings)
 * @param {Object} booking The booking record
 * @param {Object} payment The booking_payment record
 * @param {string} returnUrl URL to redirect to after processing
 * @returns {string} The WiPay redirect URL
 */
function generateCheckoutUrl(tenant, booking, payment, returnUrl) {
    const config = tenant.payment_settings || {};
    let merchantId = config.wipay_merchant_code;
    
    if (merchantId && merchantId.includes(':')) {
        merchantId = decrypt(merchantId);
    }
    
    merchantId = merchantId || process.env.WIPAY_DEFAULT_MERCHANT;
    const accountId = config.wipay_account_id || process.env.WIPAY_DEFAULT_ACCOUNT;

    if (!merchantId || !accountId) {
        throw new Error('WiPay is not fully configured for this tenant.');
    }

    // WiPay expects specific query parameters. This is a standard redirect implementation.
    // In production, you would construct a secure form POST or use their API endpoint.
    // For demonstration, we construct a URL-based integration (V1/V3 style).
    
    const params = new URLSearchParams({
        account_id: accountId,
        merchant_key: merchantId,
        total: payment.amount_due.toString(),
        currency: 'JMD', // WiPay defaults to JMD/TTD
        order_id: payment.id,
        return_url: returnUrl,
        cancel_url: returnUrl,
        customer_name: booking.name,
        customer_email: booking.email
    });

    return `https://jm.wipayfinancial.com/plugins/pay?${params.toString()}`;
}

/**
 * Verify a WiPay transaction using the transaction ID and order ID.
 * Since browser redirects can be spoofed, we must query WiPay's status API directly.
 * 
 * @param {string} transactionId The transaction ID returned by WiPay
 * @param {string} orderId The booking_payment record ID
 * @param {Object} tenant The tenant object for credentials
 */
async function verifyTransaction(transactionId, orderId, tenant) {
    const config = tenant.payment_settings || {};
    let merchantId = config.wipay_merchant_code || process.env.WIPAY_DEFAULT_MERCHANT;

    if (merchantId && merchantId.includes(':')) {
        merchantId = decrypt(merchantId);
    }

    try {
        console.log(`[WiPay] Verifying transaction ${transactionId} for Order ${orderId}`);
        
        const params = new URLSearchParams({
            order_id: orderId,
            transaction_id: transactionId,
            developer_id: merchantId
        });

        const response = await fetch('https://jm.wipayfinancial.com/api/check_status', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            },
            body: params.toString()
        });

        if (!response.ok) {
            throw new Error(`WiPay API returned HTTP ${response.status}`);
        }

        const data = await response.json();
        
        if (data.status !== 'success' && data.status !== 'approved') {
             throw new Error(`Transaction was not approved. Status: ${data.status}`);
        }

        return data;
    } catch (err) {
        console.error('[WiPay] Verification failed:', err.message);
        throw err;
    }
}

module.exports = {
    generateCheckoutUrl,
    verifyTransaction
};
