const test = require('node:test');
const assert = require('node:assert/strict');
const { singleJobWorker, QUEUE_RETRY_OPTIONS } = require('../server/services/queue');
const { requireTenantOwnership } = require('../server/middleware/auth');
const { validateEnvironment } = require('../server/services/environment');
const { agreementParagraphs } = require('../server/services/partnerAgreement');

test('pg-boss adapter passes one job object to a worker', async () => {
    let received;
    const worker = singleJobWorker('test', async job => { received = job; return 'done'; });
    assert.equal(await worker([{ id:'job-1', data:{ value:42 } }]), 'done');
    assert.deepEqual(received.data, { value:42 });
    await assert.rejects(() => worker({ data:{} }), /exactly one job/);
    await assert.rejects(() => worker([]), /exactly one job/);
    assert.equal(QUEUE_RETRY_OPTIONS['provisioning-jobs'].retryLimit, 5);
});

function responseRecorder() {
    return { statusCode:200, payload:null, status(code){ this.statusCode=code; return this; }, json(value){ this.payload=value; return this; } };
}

test('tenant ownership rejects a caller-selected foreign tenant', () => {
    const middleware = requireTenantOwnership('tenant_admin');
    const res = responseRecorder();
    let continued = false;
    middleware({ user:{ tenant_id:'tenant-a',role:'tenant_admin' }, tenant:{ id:'tenant-b',slug:'victim' }, params:{ slug:'victim' } }, res, () => { continued=true; });
    assert.equal(continued, false);
    assert.equal(res.statusCode, 403);
});

test('tenant ownership also binds the URL slug', () => {
    const middleware = requireTenantOwnership('tenant_admin');
    const res = responseRecorder();
    middleware({ user:{ tenant_id:'tenant-a',role:'tenant_admin' }, tenant:{ id:'tenant-a',slug:'mine' }, params:{ slug:'victim' } }, res, () => assert.fail('must reject'));
    assert.equal(res.statusCode, 403);
});

test('tenant ownership permits the matching tenant admin', () => {
    const middleware = requireTenantOwnership('tenant_admin');
    const res = responseRecorder();
    let continued = false;
    middleware({ user:{ tenant_id:'tenant-a',role:'tenant_admin' }, tenant:{ id:'tenant-a',slug:'mine' }, params:{ slug:'mine' } }, res, () => { continued=true; });
    assert.equal(continued, true);
});

test('production environment validation fails closed', () => {
    assert.throws(() => validateEnvironment({ NODE_ENV:'production' }), /DATABASE_URL is required/);
    const base = {
        NODE_ENV:'production',DATABASE_URL:'postgres://example',JWT_SECRET:'j'.repeat(64),RESEND_API_KEY:'re_test',
        PUBLIC_APP_URL:'https://example.com',ENCRYPTION_KEY:'a'.repeat(64),TOKEN_ENCRYPTION_KEY:'b'.repeat(64),
        PLATFORM_ADMIN_KEY:'p'.repeat(64),PAYPAL_CLIENT_ID:'client',PAYPAL_SECRET:'secret',PAYPAL_WEBHOOK_ID:'hook',PAYPAL_PLAN_ID:'plan'
    };
    assert.equal(validateEnvironment(base), true);
    assert.throws(() => validateEnvironment({ ...base, ENCRYPTION_KEY:'short' }), /64 hexadecimal/);
});

test('partner agreement uses automatic platform-wide revenue sharing', () => {
    const agreement = agreementParagraphs().join('\n');
    assert.match(agreement, /every Tenant whose paid Platform subscription begins on or after the Effective Date/i);
    assert.match(agreement, /pay the Partner’s share promptly after each qualifying subscription payment/i);
    assert.match(agreement, /Once every two weeks, on Friday/i);
    assert.match(agreement, /no fixed schedule, minimum shift, or prescribed working hours/i);
    assert.match(agreement, /Owner is responsible for calculating, reporting, withholding, remitting, and paying taxes/i);
    assert.doesNotMatch(agreement, /referral link|referral code|Referred Tenant|Referral Attribution/i);
});
