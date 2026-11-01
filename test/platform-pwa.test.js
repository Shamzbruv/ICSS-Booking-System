const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('platform installation has a distinct identity and launches the owner console', () => {
    const platform = JSON.parse(read('public/platform.webmanifest'));
    const admin = JSON.parse(read('admin/manifest.webmanifest'));
    assert.notEqual(platform.id, admin.id);
    assert.equal(platform.start_url, '/platform');
    assert.ok(platform.start_url.startsWith(platform.scope));
    assert.equal(platform.display, 'standalone');
    assert.ok(platform.icons.some(icon => icon.purpose === 'maskable'));
    for (const icon of platform.icons) assert.ok(fs.existsSync(path.join(__dirname, '..', icon.src)));
    assert.ok(!JSON.stringify(platform).includes('token'));
});

test('platform worker preserves network-only APIs and only falls back for console navigation', async () => {
    const listeners = {};
    const offline = { reconnect: true };
    vm.runInNewContext(read('public/platform-sw.js'), {
        self: { location: { origin: 'https://example.com' }, addEventListener: (name, fn) => { listeners[name] = fn; } }, URL,
        fetch: async () => { throw new Error('disconnected'); },
        caches: { match: async url => { assert.equal(url, '/platform-offline.html'); return offline; } }
    });
    for (const [method, mode, pathname] of [['GET', 'cors', '/api/v1/platform/tenants'], ['POST', 'navigate', '/platform'], ['GET', 'navigate', '/admin/index.html'], ['GET', 'navigate', '/demo/salon'], ['GET', 'navigate', '/platform-offline.html']]) {
        listeners.fetch({ request: { method, mode, url: `https://example.com${pathname}` }, respondWith() { assert.fail(`intercepted ${pathname}`); } });
    }
    for (const pathname of ['/platform', '/platform/']) {
        let response;
        listeners.fetch({ request: { method: 'GET', mode: 'navigate', url: `https://example.com${pathname}` }, respondWith(value) { response = value; } });
        assert.equal(await response, offline);
    }
});

test('production routes serve platform installation assets without SPA interception', async t => {
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
    process.env.TOKEN_ENCRYPTION_KEY = 'b'.repeat(64);
    const { app } = require('../server/app');
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.on('listening', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    for (const route of ['/platform.webmanifest', '/platform-sw.js', '/platform-offline.html']) {
        const response = await fetch(`http://127.0.0.1:${server.address().port}${route}`, { redirect: 'manual' });
        assert.equal(response.status, 200, route);
        if (route === '/platform.webmanifest') assert.equal((await response.json()).start_url, '/platform');
        if (route === '/platform-sw.js') assert.match(response.headers.get('content-type'), /javascript/);
    }
});
