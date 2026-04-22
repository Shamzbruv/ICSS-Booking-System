const { query, transaction } = require('../db/connection');

/**
 * ICSS Ledger — Double-Entry Accounting Service
 * Strictly enforces that Debits = Credits.
 */

// Define standard accounts that every tenant should have
const DEFAULT_ACCOUNTS = [
    { code: '1000', name: 'PayPal Holding Account', type: 'asset' },
    { code: '1100', name: 'WiPay Holding Account', type: 'asset' },
    { code: '1200', name: 'Manual Bank Deposits', type: 'asset' },
    { code: '4000', name: 'SaaS Subscription Revenue', type: 'revenue' },
    { code: '4100', name: 'Booking Service Revenue', type: 'revenue' },
    { code: '5000', name: 'Payment Gateway Fees', type: 'expense' },
];

/**
 * Ensures the tenant has the default chart of accounts.
 * @param {string} tenantId - UUID of the tenant
 */
async function initializeTenantAccounts(tenantId) {
    for (const acc of DEFAULT_ACCOUNTS) {
        await query(
            `INSERT INTO ledger_accounts (tenant_id, code, name, type) 
             VALUES ($1, $2, $3, $4) 
             ON CONFLICT (tenant_id, code) DO NOTHING`,
            [tenantId, acc.code, acc.name, acc.type]
        );
    }
}

/**
 * Record a double-entry transaction.
 * @param {Object} params
 * @param {string} params.tenantId - UUID of the tenant
 * @param {string} params.description - Transaction memo
 * @param {string} params.referenceType - e.g., 'subscription', 'booking'
 * @param {string} params.referenceId - Foreign ID (e.g., Stripe/PayPal/WiPay txn ID)
 * @param {Array<{accountCode: string, type: 'debit'|'credit', amount: number}>} params.entries
 */
async function createTransaction({ tenantId, description, referenceType, referenceId, entries }) {
    if (!entries || entries.length < 2) {
        throw new Error('A transaction must have at least two journal entries.');
    }

    let totalDebits = 0;
    let totalCredits = 0;

    for (const entry of entries) {
        if (entry.amount <= 0) throw new Error('Entry amounts must be strictly positive.');
        if (entry.type === 'debit') totalDebits += entry.amount;
        else if (entry.type === 'credit') totalCredits += entry.amount;
        else throw new Error(`Invalid entry type: ${entry.type}`);
    }

    // Floating point math safeguard
    if (Math.abs(totalDebits - totalCredits) > 0.001) {
        throw new Error(`Double-entry constraint violated: Debits (${totalDebits}) do not equal Credits (${totalCredits}).`);
    }

    // Execute within a strict ACID transaction block
    return await transaction(async (client) => {
        // Ensure accounts exist (to prevent foreign key errors)
        await initializeTenantAccounts(tenantId);

        // 1. Create the master transaction record
        const txnRes = await client.query(
            `INSERT INTO ledger_transactions (tenant_id, description, reference_type, reference_id)
             VALUES ($1, $2, $3, $4) RETURNING id`,
            [tenantId, description, referenceType, referenceId]
        );
        const transactionId = txnRes.rows[0].id;

        // 2. Insert journal entries
        for (const entry of entries) {
            // Lookup account_id by code
            const accRes = await client.query(
                `SELECT id FROM ledger_accounts WHERE tenant_id = $1 AND code = $2`,
                [tenantId, entry.accountCode]
            );
            
            if (accRes.rows.length === 0) {
                throw new Error(`Account code ${entry.accountCode} not found for tenant.`);
            }
            
            const accountId = accRes.rows[0].id;

            await client.query(
                `INSERT INTO journal_entries (transaction_id, account_id, type, amount)
                 VALUES ($1, $2, $3, $4)`,
                [transactionId, accountId, entry.type, entry.amount]
            );
        }

        return transactionId;
    });
}

/**
 * Fetch the ledger balance for a specific account.
 */
async function getAccountBalance(tenantId, accountCode) {
    const result = await query(`
        SELECT 
            SUM(CASE WHEN je.type = 'debit' THEN je.amount ELSE 0 END) as total_debits,
            SUM(CASE WHEN je.type = 'credit' THEN je.amount ELSE 0 END) as total_credits,
            la.type as account_type
        FROM ledger_accounts la
        LEFT JOIN journal_entries je ON je.account_id = la.id
        WHERE la.tenant_id = $1 AND la.code = $2
        GROUP BY la.id
    `, [tenantId, accountCode]);

    if (result.rows.length === 0) return 0;
    
    const row = result.rows[0];
    const debits = parseFloat(row.total_debits) || 0;
    const credits = parseFloat(row.total_credits) || 0;

    // Normal balance logic
    // Assets & Expenses increase with Debits
    // Liabilities, Equity, Revenue increase with Credits
    if (['asset', 'expense'].includes(row.account_type)) {
        return debits - credits;
    } else {
        return credits - debits;
    }
}

module.exports = {
    DEFAULT_ACCOUNTS,
    initializeTenantAccounts,
    createTransaction,
    getAccountBalance
};
