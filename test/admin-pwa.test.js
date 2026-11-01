const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');

test('admin app launch and shortcuts stay within admin scope without credentials', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'admin/manifest.webmanifest')));
    assert.equal(manifest.display, 'standalone');
    for (const href of [manifest.start_url, ...manifest.shortcuts.map(item => item.url)]) {
        assert.ok(href.startsWith(manifest.scope));
        assert.ok(fs.existsSync(path.join(root, href)));
        assert.ok(!href.includes('?'));
    }
    for (const icon of manifest.icons) {
        const bytes = fs.readFileSync(path.join(root, icon.src));
        assert.equal(bytes.readUInt32BE(16), Number(icon.sizes.split('x')[0]));
    }
});

test('worker never intercepts APIs, invoice downloads, writes, or public pages', () => {
    const listeners = {};
    vm.runInNewContext(fs.readFileSync(path.join(root, 'admin/sw.js'), 'utf8'), {
        self: { location: { origin: 'https://example.com' }, addEventListener: (name, fn) => { listeners[name] = fn; } }, URL
    });
    for (const [method, mode, url] of [
        ['GET', 'cors', '/api/v1/invoices/123'],
        ['POST', 'navigate', '/admin/index.html'],
        ['GET', 'navigate', '/book.html'],
        ['GET', 'navigate', 'https://other.example/admin/index.html']
    ]) {
        listeners.fetch({ request: { method, mode, url: new URL(url, 'https://example.com').href }, respondWith() { assert.fail(`intercepted ${url}`); } });
    }
});

test('worker fetches fresh admin navigation and falls back only on connection failure', async () => {
    const listeners = {};
    const online = { fresh: true };
    const offline = { reconnect: true };
    let fail = false;
    vm.runInNewContext(fs.readFileSync(path.join(root, 'admin/sw.js'), 'utf8'), {
        self: { location: { origin: 'https://example.com' }, addEventListener: (name, fn) => { listeners[name] = fn; } }, URL,
        fetch: async () => { if (fail) throw new Error('offline'); return online; },
        caches: { match: async url => { assert.equal(url, '/admin/offline.html'); return offline; } }
    });
    let response;
    const event = { request: { method: 'GET', mode: 'navigate', url: 'https://example.com/admin/bookings.html?_impToken=sensitive' }, respondWith(value) { response = value; } };
    listeners.fetch(event);
    assert.equal(await response, online);
    fail = true;
    listeners.fetch(event);
    assert.equal(await response, offline);
});
