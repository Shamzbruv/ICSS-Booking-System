const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('platform analytics exclude flagged test tenants from every statistic', () => {
    const platformRoute = fs.readFileSync(path.join(root, 'server/routes/v1/platform.js'), 'utf8');
    const analyticsRoute = platformRoute.slice(
        platformRoute.indexOf("router.get('/dashboard-analytics'"),
        platformRoute.indexOf("router.get('/audit-log'")
    );

    const filters = analyticsRoute.match(/is_test_account/g) || [];
    assert.ok(filters.length >= 4, 'summary, monthly, top-tenant, and status queries must all filter test tenants');
    assert.match(analyticsRoute, /active = true AND COALESCE\(is_test_account, false\) = false/);
    assert.match(analyticsRoute, /JOIN tenants t ON t\.id = b\.tenant_id/);
});

test('the seeded QA tenant is permanently marked as a test account', () => {
    const migration = fs.readFileSync(path.join(root, 'server/db/connection.js'), 'utf8');
    const seed = fs.readFileSync(path.join(root, 'scripts/seed-testing-account.js'), 'utf8');
    assert.match(migration, /slug = 'icreate-testing-account'/);
    assert.match(seed, /SET is_test_account = true/);
});
