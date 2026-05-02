function normalizeDepositConfig(service = {}) {
    const requirement = service.payment_requirement_type || 'none';
    const rawAmount = Math.max(0, Number(service.deposit_amount || 0));
    let depositType = service.deposit_type || 'percentage';

    // Legacy safety: percentages above 100 are invalid, so treat them as fixed amounts.
    if (depositType === 'percentage' && rawAmount > 100) {
        depositType = 'fixed';
    }

    return {
        ...service,
        payment_requirement_type: requirement,
        deposit_type: depositType,
        deposit_amount: rawAmount
    };
}

function calculateAmountDue(service = {}) {
    const normalized = normalizeDepositConfig(service);
    const servicePrice = Math.max(0, Number(normalized.price || 0));

    if (normalized.payment_requirement_type === 'deposit') {
        const rawAmount = normalized.deposit_type === 'percentage'
            ? servicePrice * (normalized.deposit_amount / 100)
            : normalized.deposit_amount;
        return Math.min(servicePrice, rawAmount);
    }

    if (normalized.payment_requirement_type === 'full') {
        return servicePrice;
    }

    return 0;
}

module.exports = { normalizeDepositConfig, calculateAmountDue };
