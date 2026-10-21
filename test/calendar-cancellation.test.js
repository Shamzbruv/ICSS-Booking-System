const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const db = require('../server/db/connection');

// Isolated provider transport and database: no external events or email are sent.
process.env.TOKEN_ENCRYPTION_KEY = 'a'.repeat(64);
const iv = Buffer.alloc(16, 1);
const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, 'hex'), iv);
const token = cipher.update('test-access-token', 'utf8', 'hex') + cipher.final('hex');
const encrypted = `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${token}`;
let provider, responseStatus, calls, updates;
db.query = async (sql, params) => {
    if (sql.includes('FROM calendar_connections')) return { rows: [{ provider, encrypted_access_token: encrypted }] };
    if (sql.includes('FROM tenants')) return { rows: [{ name: 'Test company', branding: { timezone: 'America/Jamaica' } }] };
    if (sql.includes('UPDATE bookings')) { updates.push({ sql, params }); return { rows: [] }; }
    throw new Error(`Unexpected query: ${sql}`);
};
const originalFetch = global.fetch;
global.fetch = async (url, options) => { calls.push({ url, options }); return { ok: responseStatus === 204, status: responseStatus, text: async () => 'Test error' }; };
const { syncBookingWithExternal } = require('../server/services/calendarSync');
test.after(() => { global.fetch = originalFetch; });

test('Google and Microsoft cancellation/rejection remove events and clear stale IDs, including already-deleted events', async () => {
    for (provider of ['google', 'microsoft']) {
        for (const status of ['cancelled', 'rejected']) {
            for (responseStatus of [204, 404, 410]) {
                calls = []; updates = [];
                await syncBookingWithExternal('tenant', { id: 'booking', status, calendar_event_id: 'event', name: 'Test customer', start_time: '2026-10-22T14:00:00Z', end_time: '2026-10-22T15:00:00Z' });
                await new Promise(resolve => setImmediate(resolve));
                assert.equal(calls.length, 1);
                assert.equal(calls[0].options.method, 'DELETE');
                assert.match(updates[0].sql, /sync_status = 'synced'/);
                assert.deepEqual(updates[0].params, [null, 'booking']);
            }
        }
    }
});

test('a rejected booking with no external event does not create a calendar event', async () => {
    provider = 'google'; calls = []; updates = [];
    await syncBookingWithExternal('tenant', { id: 'booking', status: 'rejected', start_time: '2026-10-22T14:00:00Z', end_time: '2026-10-22T15:00:00Z' });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls.length, 0);
    assert.match(updates[0].sql, /calendar_event_id = NULL/);
});
