const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
const express = require('express');
const jwt = require('jsonwebtoken');

test('tenant WhatsApp settings preserve platform limits, isolate tenants and honor consent', async () => {
    const db = new PGlite();
    const tenantId = '11111111-1111-4111-8111-111111111111';
    const otherId = '22222222-2222-4222-8222-222222222222';
    await db.exec(`
        CREATE TABLE tenants (id UUID PRIMARY KEY);
        CREATE TABLE whatsapp_settings (id INTEGER PRIMARY KEY, config JSONB);
        CREATE TABLE whatsapp_preferences (tenant_id UUID PRIMARY KEY, enabled BOOLEAN DEFAULT true,
            providers JSONB DEFAULT '[]', reminders JSONB DEFAULT '[24,2]', daily_limit INTEGER DEFAULT 100,
            enabled_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
        CREATE TABLE whatsapp_optouts (phone TEXT PRIMARY KEY);
    `);
    await db.query('INSERT INTO tenants VALUES ($1), ($2)', [tenantId, otherId]);
    await db.query('INSERT INTO whatsapp_preferences(tenant_id, daily_limit) VALUES ($1, 37), ($2, 50)', [tenantId, otherId]);
    await db.exec(`INSERT INTO whatsapp_settings VALUES(1, '{"enabled":true,"sid":"ACtest","from":"+16676604341","token":"encrypted"}')`);
    const query = db.query.bind(db);
    const modulePath = require.resolve('../server/db/connection');
    require.cache[modulePath] = { id: modulePath, filename: modulePath, loaded: true, exports: { query } };
    const { getWhatsAppPreferences, validateWhatsAppPreferences, saveWhatsAppPreferences, bookingWhatsAppStatus } = require('../server/services/whatsappPreferences');
    const settings = validateWhatsAppPreferences({ enabled: true, reminders: [24, 2, 2],
        providers: [{ name: 'Owner', phone: '8765551234', opt_in: true }] });
    await saveWhatsAppPreferences(tenantId, settings);
    const first = await getWhatsAppPreferences(tenantId);
    assert.equal(first.platform_enabled, true);
    assert.equal(first.providers[0].phone, '+18765551234');
    assert.ok(first.providers[0].consent_recorded_at);
    await saveWhatsAppPreferences(tenantId, settings);
    assert.equal((await getWhatsAppPreferences(tenantId)).providers[0].consent_recorded_at, first.providers[0].consent_recorded_at);
    assert.equal((await query('SELECT daily_limit FROM whatsapp_preferences WHERE tenant_id=$1', [tenantId])).rows[0].daily_limit, 37);
    assert.equal(await bookingWhatsAppStatus(tenantId, '+18765559876', false, query), 'not_requested');
    assert.equal(await bookingWhatsAppStatus(tenantId, '+18765559876', true, query), 'pending');
    await assert.rejects(bookingWhatsAppStatus(tenantId, '123', true, query), /full WhatsApp number/);
    await query('INSERT INTO whatsapp_optouts VALUES ($1)', ['+18765559876']);
    assert.equal(await bookingWhatsAppStatus(tenantId, '+18765559876', true, query), 'unavailable');
    await saveWhatsAppPreferences(tenantId, { ...settings, enabled: false });
    assert.equal(await bookingWhatsAppStatus(tenantId, '+18765551234', true, query), 'unavailable');
    assert.throws(() => validateWhatsAppPreferences({ ...settings, reminders: [0] }), /reminder times/);
    assert.throws(() => validateWhatsAppPreferences({ ...settings, providers: [settings.providers[0], settings.providers[0]] }), /only once/);

    const app = express();
    app.use(express.json());
    app.use((req, res, next) => { req.tenant = { id: req.get('X-Tenant-ID') || tenantId }; next(); });
    app.use('/api/v1/admin', require('../server/routes/v1/admin'));
    app.use('/api/v1/public', require('../server/routes/v1/public'));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const endpoint = `http://127.0.0.1:${server.address().port}/api/v1/admin/whatsapp-settings`;
    const publicEndpoint = `http://127.0.0.1:${server.address().port}/api/v1/public/tenant`;
    const token = role => jwt.sign({ id: tenantId, tenant_id: tenantId, role }, process.env.JWT_SECRET || 'dev_secret_change_in_production');
    try {
        assert.equal((await (await fetch(publicEndpoint)).json()).whatsapp_available, false);
        const headers = { Authorization: `Bearer ${token('tenant_admin')}`, 'Content-Type': 'application/json' };
        const saved = await fetch(endpoint, { method: 'PUT', headers, body: JSON.stringify({ ...settings, daily_limit: 9999 }) });
        assert.equal(saved.status, 200);
        assert.equal((await saved.json()).enabled, true);
        const publicTenant = await (await fetch(publicEndpoint)).json();
        assert.equal(publicTenant.whatsapp_available, true);
        assert.ok(!JSON.stringify(publicTenant).includes('+18765551234'));
        assert.equal((await query('SELECT daily_limit FROM whatsapp_preferences WHERE tenant_id=$1', [tenantId])).rows[0].daily_limit, 37);
        assert.equal((await fetch(endpoint, { headers: { ...headers, 'X-Tenant-ID': otherId } })).status, 403);
        assert.equal((await fetch(endpoint, { headers: { Authorization: `Bearer ${token('staff')}` } })).status, 403);
        assert.equal((await fetch(endpoint)).status, 401);
        assert.equal((await getWhatsAppPreferences(otherId)).providers.length, 0);
    } finally {
        await new Promise(resolve => server.close(resolve));
        await db.close();
    }
});
