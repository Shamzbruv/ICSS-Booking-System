'use strict';

const DEFAULT_JMD_PER_USD = 160;

function getJmdPerUsdRate() {
    const configured = Number(process.env.PAYPAL_JMD_PER_USD);
    return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_JMD_PER_USD;
}

function convertForPayPal(amount, currency) {
    const sourceAmount = Number(amount);
    const sourceCurrency = String(currency || 'JMD').toUpperCase();
    if (!Number.isFinite(sourceAmount) || sourceAmount <= 0) {
        throw new Error('A valid payment amount is required.');
    }

    if (sourceCurrency === 'USD') {
        return { sourceAmount, sourceCurrency, usdAmount: Number(sourceAmount.toFixed(2)), jmdPerUsd: null };
    }
    if (sourceCurrency !== 'JMD') {
        throw new Error(`PayPal conversion is not configured for ${sourceCurrency}.`);
    }

    const jmdPerUsd = getJmdPerUsdRate();
    return {
        sourceAmount,
        sourceCurrency,
        usdAmount: Number((sourceAmount / jmdPerUsd).toFixed(2)),
        jmdPerUsd
    };
}

module.exports = { convertForPayPal, getJmdPerUsdRate, DEFAULT_JMD_PER_USD };
