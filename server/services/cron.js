const { query } = require('../db/connection');
const calendarSync = require('./calendarSync');

/**
 * Background worker to renew expiring calendar webhooks.
 * Runs periodically to ensure Microsoft and Google subscriptions stay alive.
 */
async function runWebhookRenewals() {
    console.log('[Cron] Checking for expiring calendar webhooks...');
    try {
        // Find subscriptions expiring within the next 24 hours
        const result = await query(`
            SELECT * FROM calendar_connections 
            WHERE sync_expires_at IS NOT NULL 
            AND sync_expires_at < NOW() + INTERVAL '24 hours'
        `);

        for (const connection of result.rows) {
            console.log(`[Cron] Renewing webhook for tenant ${connection.tenant_id} (${connection.provider})`);
            // The subscribeToWebhooks function already deletes the old one and recreates it if called again
            await calendarSync.subscribeToWebhooks(connection.tenant_id, connection.provider);
        }
    } catch (e) {
        console.error('[Cron] Webhook renewal error:', e.message);
    }
}

// Start cron interval (every 6 hours)
function startCronJobs() {
    const SIX_HOURS = 6 * 60 * 60 * 1000;
    setInterval(runWebhookRenewals, SIX_HOURS);
    
    // Run once on startup after 5 seconds
    setTimeout(runWebhookRenewals, 5000);
}

module.exports = { startCronJobs };
