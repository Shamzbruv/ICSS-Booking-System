const PgBoss = require('pg-boss');
require('dotenv').config();

let boss;

/**
 * Initializes the pg-boss background job queue using the existing PostgreSQL connection.
 */
async function initQueue() {
    if (boss) return boss;

    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('DATABASE_URL is required for pg-boss');
    }

    // Configure pg-boss. Using the same database connection string ensures
    // jobs are stored in the same database, allowing for ACID transactional guarantees.
    boss = new PgBoss(connectionString);

    boss.on('error', error => console.error('[pg-boss] Error:', error));

    await boss.start();
    console.log('✅ pg-boss background queue started');

    // ── Worker: PayPal Webhook → Ledger ────────────────────────────────────────
    // retryLimit: 5 attempts with exponential backoff (retryDelay doubles each time)
    const { processPayPalWebhook } = require('./ledgerQueueWorkers');
    await boss.work('paypal-webhooks', { retryLimit: 5, retryDelay: 60 }, processPayPalWebhook);

    // ── Worker: Invoice Generation → Email Dispatch ────────────────────────────
    const { processInvoiceDispatch } = require('./invoiceWorker');
    await boss.work('invoice-dispatch', { retryLimit: 3, retryDelay: 30 }, processInvoiceDispatch);

    // ── Worker: Booking Hold Expiration ────────────────────────────────────────
    const { processExpireBookingHold } = require('./bookingWorker');
    await boss.work('expire-booking-hold', { retryLimit: 1 }, processExpireBookingHold);

    return boss;
}

/**
 * Get the initialized pg-boss instance.
 */
function getQueue() {
    if (!boss) throw new Error('pg-boss is not initialized');
    return boss;
}

/**
 * Enqueue a background job.
 * @param {string} queueName - Name of the queue (e.g., 'paypal-webhooks')
 * @param {Object} data - The payload to pass to the worker
 * @param {Object} options - pg-boss job options (e.g., retryLimit, startAfter)
 */
async function enqueue(queueName, data, options = {}) {
    const b = getQueue();
    return b.send(queueName, data, options);
}

module.exports = { initQueue, getQueue, enqueue };
