const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');
process.env.ENCRYPTION_KEY ||= 'a'.repeat(64);
const secret = process.env.JWT_SECRET || 'dev_secret_change_in_production';
const db = require('../server/db/connection');
let state, media, writes;
db.query = async (sql, params = []) => {
    if (sql.startsWith('SELECT id FROM tenant_media')) return { rows: media.filter(m => m.tenant_id === params[0] && m.mime === params[1] && m.data.equals(params[3])) };
    if (sql.startsWith('SELECT COALESCE(SUM(size_bytes)')) return { rows: [{ used: media.reduce((sum, m) => sum + m.size_bytes, 0) }] };
    if (sql.includes('INSERT INTO tenant_media')) {
        const row = { id: randomUUID(), tenant_id: params[0], kind: params[1], mime: params[2], filename: params[3], size_bytes: params[4], width: params[5], height: params[6], duration_seconds: params[7], data: params[8] };
        media.push(row); writes++; return { rows: [row] };
    }
    if (sql.includes('UPDATE tenants SET site_draft = $1')) { state.site_draft = JSON.parse(params[0]); writes++; return { rows: [state] }; }
    if (sql.includes('UPDATE tenants SET site_config = $1')) { state.site_draft = JSON.parse(params[0]); state.site_config = state.site_draft; state.site_published_at = new Date().toISOString(); writes++; return { rows: [state] }; }
    if (sql.includes('SELECT site_draft, site_config, site_published_at')) return { rows: [state] };
    if (sql.startsWith('SELECT branding')) return { rows: [state] };
    if (sql.startsWith('UPDATE tenants SET branding')) { state.branding = JSON.parse(params[0]); writes++; return { rows: [state] }; }
    throw new Error('Unexpected SQL in site-save roundtrip: ' + sql.slice(0, 80));
};
const routes = require('../server/routes/v1/tenants');
const image = Buffer.alloc(610 * 1024);
Buffer.from('89504e470d0a1a0a0000000d', 'hex').copy(image);
const inline = `data:image/png;base64,${image.toString('base64')}`;
const site = { brand: { name: 'Salon', logoUrl: inline }, pages: [{ id: 'home', sections: [{ id: 'hero', type: 'hero', props: { headline: 'My new headline', imageUrl: 'https://example.com/hero.jpg' } }] }] };

async function withApi(run) {
    state = { site_draft: null, site_config: null, site_published_at: null, branding: {} }; media = []; writes = 0;
    const app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use((req, res, next) => { req.tenant = { id: 'tenant-a', slug: 'salon' }; next(); });
    app.use('/api/v1/tenants', routes);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const request = async (path, { method = 'GET', body, tenant_id = 'tenant-a', role = 'tenant_admin' } = {}) => {
        const token = jwt.sign({ id: 'admin-a', role, tenant_id }, secret);
        const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/tenants/salon${path}`, {
            method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {})
        });
        return { status: response.status, data: await response.json() };
    };
    try { await run(request); } finally { await new Promise(resolve => server.close(resolve)); }
}

test('real draft/publish routes save and reload a large inherited logo without losing edits', () => withApi(async request => {
    const saved = await request('/site/draft', { method: 'PUT', body: { site } });
    assert.equal(saved.status, 200);
    assert.match(saved.data.draft.brand.logoUrl, /^\/media\//);
    assert.equal(saved.data.draft.pages[0].sections[0].props.headline, 'My new headline');
    assert.deepEqual(media[0].data, image);
    const reloaded = await request('/site');
    assert.deepEqual(reloaded.data.draft, saved.data.draft);
    const published = await request('/site/publish', { method: 'POST', body: { site } });
    assert.equal(published.status, 200);
    assert.deepEqual(published.data.published, saved.data.draft);
    assert.equal(media.length, 1, 'retry/publish must reuse the same image');
    assert.deepEqual((await request('/site')).data.published, published.data.published);
}));

test('brand settings accept a media-library logo and convert old embedded images', () => withApi(async request => {
    const response = await request('/branding', { method: 'PATCH', body: { logoUrl: inline } });
    assert.equal(response.status, 200);
    const logoUrl = response.data.branding.logoUrl;
    assert.match(logoUrl, /^\/media\//);
    const repeated = await request('/branding', { method: 'PATCH', body: { logoUrl, timezone: 'America/Jamaica' } });
    assert.equal(repeated.status, 200);
    assert.equal(repeated.data.branding.logoUrl, logoUrl);
    assert.equal(media.length, 1);
}));

test('invalid oversized drafts preserve the previous saved draft', () => withApi(async request => {
    await request('/site/draft', { method: 'PUT', body: { site } });
    const snapshot = JSON.stringify(state.site_draft), beforeWrites = writes;
    const response = await request('/site/draft', { method: 'PUT', body: { site: { footer: { text: 'x'.repeat(300 * 1024) } } } });
    assert.equal(response.status, 400);
    assert.equal(JSON.stringify(state.site_draft), snapshot);
    assert.equal(writes, beforeWrites);
}));

test('foreign tenants and customer roles cannot upload images or save another business site', () => withApi(async request => {
    for (const options of [{ tenant_id: 'foreign-tenant' }, { role: 'customer' }]) {
        const response = await request('/site/draft', { method: 'PUT', body: { site }, ...options });
        assert.equal(response.status, 403);
    }
    assert.equal(writes, 0);
    assert.equal(media.length, 0);
}));
