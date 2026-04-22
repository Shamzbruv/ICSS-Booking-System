/**
 * Audit Logger — server/services/audit.js
 *
 * Writes immutable records to the audit_log table for:
 *   - Financial transactions (subscription renewals, payment declines)
 *   - Subscription state changes (activated, cancelled, expired)
 *   - Booking confirmations and cancellations
 *
 * Call logAudit() from any service or route handler.
 */

const { query } = require('../db/connection');

/**
 * Log an audit event.
 * @param {Object} params
 * @param {string}  params.tenantId    - Tenant UUID (null for platform-level events)
 * @param {string}  [params.userId]    - Acting user UUID
 * @param {string}  params.action      - Machine-readable action key (e.g. 'subscription.activated')
 * @param {string}  [params.entity]    - Entity type (e.g. 'tenant', 'booking', 'payment')
 * @param {string}  [params.entityId]  - Entity UUID
 * @param {Object}  [params.metadata]  - Arbitrary JSON detail (amounts, status transitions)
 * @param {string}  [params.ipAddress] - IP address of the actor (for HTTP requests)
 */
async function logAudit({ tenantId, userId = null, action, entity = null, entityId = null, metadata = {}, ipAddress = null }) {
    try {
        await query(
            `INSERT INTO audit_log (tenant_id, user_id, action, entity, entity_id, metadata, ip_address)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [tenantId || null, userId, action, entity, entityId, JSON.stringify(metadata), ipAddress]
        );
    } catch (err) {
        // Audit failure must NEVER crash the main application flow
        console.error('[AuditLog] Failed to write audit record:', err.message, { action, tenantId, entityId });
    }
}

/**
 * Express middleware to automatically capture req.ip on every authenticated route.
 * Attach this to req so downstream audit calls can easily pick up the IP.
 */
function attachAuditContext(req, res, next) {
    req.auditIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    next();
}

module.exports = { logAudit, attachAuditContext };
