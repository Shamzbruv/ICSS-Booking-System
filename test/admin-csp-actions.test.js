const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const adminRoot = path.join(projectRoot, 'admin');

function adminHtmlFiles() {
    return fs.readdirSync(adminRoot)
        .filter((name) => name.endsWith('.html'))
        .map((name) => path.join(adminRoot, name));
}

test('admin pages do not use CSP-blocked inline event attributes', () => {
    const violations = [];
    for (const file of adminHtmlFiles()) {
        const html = fs.readFileSync(file, 'utf8');
        const matches = html.match(/\son[a-z]+\s*=\s*["']/gi) || [];
        if (matches.length) violations.push(`${path.basename(file)}: ${matches.join(', ')}`);
    }
    assert.deepEqual(violations, []);
});

test('critical admin actions are wired through event listeners', () => {
    const shared = fs.readFileSync(path.join(adminRoot, 'js', 'admin.js'), 'utf8');
    const bookings = fs.readFileSync(path.join(adminRoot, 'bookings.html'), 'utf8');
    const login = fs.readFileSync(path.join(adminRoot, 'login.html'), 'utf8');

    assert.match(shared, /querySelectorAll\('\.logout-btn'\)/);
    assert.match(shared, /button\.addEventListener\('click', logout\)/);
    assert.match(bookings, /data-booking-action="status"/);
    assert.match(bookings, /addEventListener\('click', handleBookingAction\)/);
    assert.match(login, /addEventListener\('submit', handleLogin\)/);
});

test('every admin page with navigation exposes responsive menu and sign out controls', () => {
    for (const file of adminHtmlFiles()) {
        const html = fs.readFileSync(file, 'utf8');
        if (!html.includes('sidebar-nav')) continue;
        assert.match(html, /id="hamburgerBtn"/, `${path.basename(file)} needs a menu button`);
        assert.match(html, /id="sidebarBackdrop"/, `${path.basename(file)} needs a menu backdrop`);
        assert.match(html, /id="sidebar"/, `${path.basename(file)} needs a target sidebar`);
        assert.match(html, /class="logout-btn"/, `${path.basename(file)} needs a Sign Out button`);
    }
});

test('production CSP blocks inline event attributes while admin HTML remains usable', async (t) => {
    process.env.NODE_ENV = 'test';
    process.env.ENCRYPTION_KEY = 'a'.repeat(64);
    process.env.TOKEN_ENCRYPTION_KEY = 'b'.repeat(64);
    const { app } = require('../server/app');
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));

    const response = await fetch(`http://127.0.0.1:${server.address().port}/admin/bookings.html`);
    assert.equal(response.status, 200);
    const csp = response.headers.get('content-security-policy') || '';
    assert.match(csp, /script-src-attr 'none'/);
    assert.doesNotMatch(await response.text(), /\son[a-z]+\s*=\s*["']/i);
});
