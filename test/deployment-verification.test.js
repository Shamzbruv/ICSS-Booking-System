const test = require('node:test');
const assert = require('node:assert/strict');
const { verifyRailwayDeployment, RAILWAY_CONTEXT } = require('../scripts/verify-railway-deployment');
const base = { repository: 'Shamzbruv/ICSS-Booking-System', sha: 'a'.repeat(40), token: 'test-token', attempts: 2, pollMs: 0, sleep: async () => {} };
const response = data => ({ ok: true, json: async () => data });

test('deployment verification waits for Railway success on the exact commit', async () => {
    let requests = 0;
    const result = await verifyRailwayDeployment({ ...base, fetchStatus: async (url, options) => {
        assert.ok(url.includes(`/commits/${base.sha}/statuses`));
        assert.equal(options.headers.Authorization, 'Bearer test-token');
        requests++;
        return response([{ context: RAILWAY_CONTEXT, state: requests === 1 ? 'pending' : 'success' }]);
    } });
    assert.equal(requests, 2);
    assert.equal(result.state, 'success');
});

test('a failed Railway deployment cannot be reported as a successful production deploy', async () => {
    await assert.rejects(verifyRailwayDeployment({ ...base, fetchStatus: async () => response([{ context: RAILWAY_CONTEXT, state: 'failure' }]) }), /Railway deployment failed/);
});

test('missing Railway status and API errors fail clearly instead of passing', async () => {
    await assert.rejects(verifyRailwayDeployment({ ...base, fetchStatus: async () => response([{ context: 'other-service', state: 'success' }]) }), /did not confirm/);
    await assert.rejects(verifyRailwayDeployment({ ...base, fetchStatus: async () => ({ ok: false, status: 403 }) }), /HTTP 403/);
});
