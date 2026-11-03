const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const fs = require('node:fs');
const vm = require('node:vm');
const { createApiRateLimiter, authLimiter, paymentLimiter } = require('../server/middleware/rateLimiter');
const secret = process.env.JWT_SECRET || 'dev_secret_change_in_production';
const token = (id, extra = {}) => jwt.sign({ id, role: 'tenant_admin', tenant_id: 'tenant-a', ...extra }, secret);

async function withApi(run) {
    const app = express();
    app.set('trust proxy', 1);
    app.use(createApiRateLimiter({ readMax: 2, writeMax: 2, adminMax: 3 }));
    app.all('/auth', authLimiter, (req, res) => res.json({ ok: true }));
    app.all('/payment', paymentLimiter, (req, res) => res.json({ ok: true }));
    app.use((req, res) => res.json({ ok: true }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const request = async (authorization, options = {}) => {
        const res = await fetch(`http://127.0.0.1:${server.address().port}${options.path || '/'}`, {
            method: options.method || 'GET',
            headers: { ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}), ...options.headers }
        });
        await res.text();
        return res;
    };
    try { await run(request); } finally { await new Promise(resolve => server.close(resolve)); }
}

test('public read exhaustion does not block admin preview or customer booking writes', () => withApi(async request => {
    assert.equal((await request()).status, 200);
    assert.equal((await request()).status, 200);
    const limited = await request();
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get('retry-after')) > 0);
    assert.equal((await request(token('admin-a'))).status, 200);
    assert.equal((await request(null, { method: 'POST' })).status, 200);
    assert.equal((await request(null, { method: 'POST' })).status, 200);
    assert.equal((await request(null, { method: 'POST' })).status, 429);
}));

test('admin budgets follow the verified account across IPs and ignore tenant headers', () => withApi(async request => {
    const admin = token('admin-a');
    for (let i = 0; i < 3; i++) {
        assert.equal((await request(admin, { headers: { 'X-Tenant-Slug': `slug-${i}`, 'X-Forwarded-For': `192.0.2.${i + 1}` } })).status, 200);
    }
    assert.equal((await request(admin, { headers: { 'X-Tenant-Slug': 'another', 'X-Forwarded-For': '192.0.2.10' } })).status, 429);
    assert.equal((await request(token('admin-b'))).status, 200);
    assert.equal((await request()).status, 200);
}));

test('forged, expired, malformed and customer tokens cannot obtain an admin budget', () => withApi(async request => {
    await request(); await request();
    const forged = jwt.sign({ id: 'attacker', role: 'platform_owner' }, 'incorrect-secret');
    const expired = jwt.sign({ id: 'admin-a', role: 'tenant_admin', exp: 1 }, secret);
    for (const candidate of [forged, expired, 'malformed', token('customer', { role: 'customer' })]) {
        assert.equal((await request(candidate)).status, 429);
    }
    assert.equal((await request(token('admin-a'))).status, 200);
}));

test('dedicated login and payment limits still reject excessive authenticated requests', () => withApi(async request => {
    // Distinct signed accounts avoid the intentionally tiny general test budget.
    for (let i = 0; i < 20; i++) assert.equal((await request(token(`login-${i}`), { method: 'POST', path: '/auth' })).status, 200);
    assert.equal((await request(token('login-over'), { method: 'POST', path: '/auth' })).status, 429);
    for (let i = 0; i < 10; i++) assert.equal((await request(token(`pay-${i}`), { method: 'POST', path: '/payment' })).status, 200);
    assert.equal((await request(token('pay-over'), { method: 'POST', path: '/payment' })).status, 429);
}));

function builderInstance() {
    const window = {};
    vm.runInNewContext(fs.readFileSync(require.resolve('../admin/js/siteBuilder.js'), 'utf8'), { window, clearTimeout });
    const builder = Object.create(window.SiteBuilder.prototype);
    Object.assign(builder, {
        site: { title: 'Unsaved work' }, savedJson: '{}', saving: false,
        updateStatus() {}, toast() {}, scheduleSave() { this.scheduled = true; },
        api: {}
    });
    return builder;
}

test('failed draft saves retain changes without scheduling an endless retry', async () => {
    const builder = builderInstance();
    builder.api.saveDraft = async () => { throw new Error('Too many requests'); };
    await builder.saveDraft();
    assert.equal(builder.isDirty(), true);
    assert.equal(builder.savedJson, '{}');
    assert.equal(builder.saving, false);
    assert.equal(builder.scheduled, undefined);
});

test('edits made during a successful save still schedule a follow-up save', async () => {
    const builder = builderInstance();
    builder.api.saveDraft = async () => { builder.site.title = 'Newer edit'; };
    await builder.saveDraft();
    assert.equal(builder.scheduled, true);
    assert.equal(JSON.parse(builder.savedJson).title, 'Unsaved work');
});

test('failed saved-site loading cannot initialise defaults in place of the real draft', async () => {
    const builder = builderInstance();
    builder.site = null;
    builder.mode = 'tenant';
    builder.api.loadSite = async () => { throw new Error('Too many requests'); };
    builder.showLoadError = message => { builder.loadError = message; };
    await builder.handleReady({ catalog: {}, defaults: {}, resolved: { title: 'Default content' } });
    assert.equal(builder.site, null);
    assert.equal(builder.initialised, false);
    assert.equal(builder.loadError, 'Too many requests');
});

test('the editor adopts canonical saved media URLs after a successful save', async () => {
    const builder = builderInstance();
    builder.post = () => {};
    builder.site = { title: 'My heading', brand: { logoUrl: 'data:image/png;base64,old' } };
    const draft = { title: 'My heading', brand: { logoUrl: '/media/93fcb692-3c96-4c7e-8a7c-a926cf2782d0' }, version: 1 };
    builder.api.saveDraft = async () => ({ draft });
    await builder.saveDraft();
    assert.equal(builder.site.brand.logoUrl, draft.brand.logoUrl);
    assert.equal(builder.isDirty(), false);
    assert.equal(builder.scheduled, undefined);
});

test('canonical save responses cannot overwrite a newer edit made during the request', async () => {
    const builder = builderInstance();
    builder.site = { title: 'First heading' };
    builder.api.saveDraft = async () => {
        builder.site.title = 'Newer heading';
        return { draft: { title: 'First heading', version: 1 } };
    };
    await builder.saveDraft();
    assert.equal(builder.site.title, 'Newer heading');
    assert.equal(builder.isDirty(), true);
    assert.equal(builder.scheduled, true);
});
