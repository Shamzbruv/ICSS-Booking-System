const PgBoss = require('pg-boss');
require('dotenv').config();

let boss;

const QUEUE_RETRY_OPTIONS = Object.freeze({
    'paypal-webhooks':    { retryLimit: 5, retryDelay: 60, retryBackoff: true },
    'invoice-dispatch':   { retryLimit: 3, retryDelay: 30, retryBackoff: true },
    'expire-booking-hold':{ retryLimit: 1, retryDelay: 15 },
    'provisioning-jobs':  { retryLimit: 5, retryDelay: 60, retryBackoff: true },
    'email-outbox':       { retryLimit: 8, retryDelay: 60, retryBackoff: true },
});

function singleJobWorker(name, handler) {
    return async jobs => {
        if (!Array.isArray(jobs) || jobs.length !== 1 || !jobs[0]?.data) {
            throw new Error(`[pg-boss] ${name} expected exactly one job with a data payload.`);
        }
        return handler(jobs[0]);
    };
}

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
    const { processPayPalWebhook } = require('./ledgerQueueWorkers');
    await boss.work('paypal-webhooks', singleJobWorker('paypal-webhooks', processPayPalWebhook));

    // ── Worker: Invoice Generation → Email Dispatch ────────────────────────────
    const { processInvoiceDispatch } = require('./invoiceWorker');
    await boss.work('invoice-dispatch', singleJobWorker('invoice-dispatch', processInvoiceDispatch));

    // ── Worker: Booking Hold Expiration ────────────────────────────────────────
    const { processExpireBookingHold } = require('./bookingWorker');
    await boss.work('expire-booking-hold', singleJobWorker('expire-booking-hold', processExpireBookingHold));

    // ── Worker: Tenant Provisioning ────────────────────────────────────────────
    const { processProvisioningJob } = require('./provisioning');
    await boss.work('provisioning-jobs', singleJobWorker('provisioning-jobs', processProvisioningJob));

    const { processEmailOutbox } = require('./emailOutbox');
    await boss.work('email-outbox', singleJobWorker('email-outbox', processEmailOutbox));
    const { query } = require('../db/connection');
    const pendingEmails = await query(`SELECT id FROM email_outbox WHERE status<>'sent' AND next_attempt_at<=NOW() ORDER BY created_at LIMIT 100`);
    for (const row of pendingEmails.rows) await boss.send('email-outbox', { outboxId:row.id }, QUEUE_RETRY_OPTIONS['email-outbox']);

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
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new TypeError(`Queue ${queueName} requires an object payload.`);
    }
    const b = getQueue();
    return b.send(queueName, data, { ...(QUEUE_RETRY_OPTIONS[queueName] || {}), ...options });
}

module.exports = { initQueue, getQueue, enqueue, singleJobWorker, QUEUE_RETRY_OPTIONS };
