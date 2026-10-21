const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');
const db = require('../server/db/connection');
const tenantId = '11111111-1111-4111-8111-111111111111';
const bookingId = '44444444-4444-4444-8444-444444444444';
const foreignId = '33333333-3333-4333-8333-333333333333';
let saved = [], bookingStatus = 'completed', invoiceRows = [], payments = [], mail = [];
const tenant = { id: tenantId, slug: 'test-company', name: 'Test Company', branding: { replyEmail: 'business@example.com', timezone: 'America/Jamaica' } };
const booking = { id: bookingId, tenant_id: tenantId, name: 'Jordan Williams', email: 'client@example.com', phone: '+18765550123', booking_date: '2026-10-25', booking_time: '10:00', service_price: 10000, service_currency: 'JMD', payment_mode: 'manual', service_name: 'Original service', duration_minutes: 60, status: 'confirmed' };
async function fakeQuery(sql, args = []) {
    if (sql.includes('FROM booking_reviews') && sql.includes('AVG')) return { rows: [{ count: saved.length, average: saved.length ? saved.reduce((s, r) => s + r.rating, 0) / saved.length : 0 }] };
    if (sql.includes('FROM booking_reviews')) return { rows: saved.filter(r => r.tenant_id === args[0] && (!args[1] || Number(r.id) < Number(args[1]))).sort((a,b) => b.id-a.id).slice(0, args[2]) };
    if (sql.includes('FROM bookings')) return { rows: args[0] === bookingId && args[1] === tenantId ? [{ ...booking, status: bookingStatus }] : [] };
    if (sql.includes('INSERT INTO booking_reviews')) {
        let row = saved.find(r => r.booking_id === args[1]);
        if (!row) { row = { id: String(saved.length + 1), tenant_id: args[0], booking_id: args[1], display_name: args[2], created_at: new Date() }; saved.push(row); }
        Object.assign(row, { rating: args[3], comment: args[4] }); return { rows: [row] };
    }
    if (sql.includes('FROM booking_invoices')) return { rows: invoiceRows.filter(r => r.booking_id === args[0] && r.tenant_id === args[1]) };
    if (sql.includes('INSERT INTO booking_invoices')) { const row = { id: '123', tenant_id: args[0], booking_id: args[1], snapshot: JSON.parse(args[2]), created_at: new Date('2026-10-20') }; invoiceRows.push(row); return { rows: [row] }; }
    if (sql.includes('FROM booking_payments')) return { rows: payments };
    if (sql.includes('FROM services')) return { rows: [{ name: 'Current changed service', price: 20000, currency: 'JMD', duration_minutes: 60 }] };
    if (sql.includes('FROM users')) return { rows: [] };
    if (sql.includes('UPDATE tenants')) { tenant.invoice_settings = JSON.parse(args[0]); return { rows: [] }; }
    if (sql.includes('FROM tenant_media')) return { rows: [] };
    throw new Error(`Unexpected query: ${sql}`);
}
db.query = fakeQuery; db.transaction = callback => callback({ query: fakeQuery });
const resendId = require.resolve('resend');
class FakeResend {
    constructor() {
        this.emails = { send: async message => { mail.push(message); return { data: { id: 'test-email' } }; } };
    }
}
require.cache[resendId] = { id: resendId, filename: resendId, loaded: true, exports: { Resend: FakeResend } };
process.env.RESEND_API_KEY = 'test-no-network';
const inv = require('../server/services/bookingInvoices');
const reviews = require('../server/services/bookingReviews');
const email = require('../server/services/email');
const { signToken } = require('../server/middleware/auth');
const app = express(); app.use(express.json({ limit: '2mb' })); app.use((req, res, next) => { req.tenant = tenant; next(); });
app.use('/reviews', require('../server/routes/v1/reviews')); app.use('/invoices', require('../server/routes/v1/invoices'));
let server, base;
test.before(async () => { server = http.createServer(app); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${server.address().port}`; });
test.after(() => new Promise(resolve => server.close(resolve)));
test.beforeEach(() => { saved = []; invoiceRows = []; payments = []; mail = []; bookingStatus = 'completed'; delete tenant.invoice_settings; });
const auth = (role = 'tenant_admin', tenant_id = tenantId) => signToken({ id: '22222222-2222-4222-8222-222222222222', tenant_id, role });
async function request(path, body, token, method = 'POST') { return fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); }
const feedback = (overrides = {}) => ({ token: reviews.reviewToken(booking), rating: 5, comment: 'Very helpful team.', publishConsent: true, ...overrides });

test('reviews require completed bookings, valid tenant-bound invitations and explicit publishing consent', async () => {
    for (const body of [feedback({ token: '' }), feedback({ token: auth() }), feedback({ token: reviews.reviewToken({ ...booking, tenant_id: foreignId }) })]) assert.equal((await request('/reviews', body)).status, 401);
    for (const body of [feedback({ rating: 6 }), feedback({ rating: '5' }), feedback({ comment: '' }), feedback({ comment: 'a'.repeat(1201) }), feedback({ publishConsent: false })]) assert.equal((await request('/reviews', body)).status, 400);
    bookingStatus = 'confirmed'; assert.equal((await request('/reviews', feedback())).status, 403);
    bookingStatus = 'cancelled'; assert.equal((await request('/reviews', feedback())).status, 403);
    assert.equal(saved.length, 0);
});
test('one completed booking contributes one review; editing changes the score rather than adding votes', async () => {
    assert.equal((await request('/reviews', feedback())).status, 201);
    assert.equal((await request('/reviews', feedback({ rating: 3, comment: 'Updated feedback' }))).status, 201);
    assert.equal(saved.length, 1); assert.equal(saved[0].display_name, 'Jordan W.');
    const data = await (await fetch(base + '/reviews')).json();
    assert.equal(data.summary.count, 1); assert.equal(data.summary.average, 3);
});
test('public reviews default to three and paginate without returning booking identities', async () => {
    saved = Array.from({ length: 24 }, (_, i) => ({ id: String(i+1), tenant_id: tenantId, display_name: 'Customer', rating: 5, comment: 'Good service', created_at: new Date() }));
    const first = await (await fetch(base + '/reviews')).json();
    assert.equal(first.reviews.length, 3); assert.equal(first.nextCursor, '22');
    assert.equal('tenant_id' in first.reviews[0], false);
    assert.equal('booking_id' in first.reviews[0], false);
    const next = await (await fetch(base + '/reviews?limit=20&before=' + first.nextCursor)).json();
    assert.equal(next.reviews.length, 20); assert.equal(next.nextCursor, '2');
    assert.equal((await fetch(base + '/reviews?before=invalid')).status, 400);
});
test('review invitations expire and do not share the normal account-token audience', () => {
    const jwt = require('jsonwebtoken');
    const invitation = reviews.reviewToken(booking);
    assert.throws(() => jwt.verify(invitation, process.env.JWT_SECRET || 'dev_secret_change_in_production'), /signature/);
    const now = Date.now;
    try { Date.now = () => now() + 181 * 86400000; assert.throws(() => reviews.verifyReviewToken(invitation, tenantId), /expired/); }
    finally { Date.now = now; }
    const url = reviews.reviewUrl(booking, tenant); assert.match(url, /\/test-company\/book#review=/); assert.equal(new URL(url).search, '');
});
test('invoice settings and downloads enforce tenant roles and ownership', async () => {
    assert.equal((await request('/invoices/settings', null, null, 'GET')).status, 401);
    assert.equal((await request('/invoices/settings', null, auth('customer'), 'GET')).status, 403);
    assert.equal((await request('/invoices/settings', null, auth('tenant_admin', foreignId), 'GET')).status, 403);
    assert.equal((await request('/invoices/settings', {}, auth('staff'), 'PUT')).status, 403);
    assert.equal((await request('/invoices/settings', { primaryColor: 'red' }, auth(), 'PUT')).status, 400);
    assert.equal((await request('/invoices/settings', { logoUrl: 'http://localhost/private' }, auth(), 'PUT')).status, 400);
    assert.equal((await request('/invoices/settings', { primaryColor: '#123456', footer: 'Thanks!' }, auth(), 'PUT')).status, 200);
    assert.equal((await request(`/invoices/${foreignId}/pdf`, null, auth(), 'GET')).status, 404);
});
test('invoice snapshots preserve original service, price and branding after later edits', async () => {
    const first = await inv.ensureBookingInvoice(booking, tenant, { name: 'Original service' });
    const second = await inv.ensureBookingInvoice({ ...booking, service_price: 90000 }, { ...tenant, name: 'Changed name' }, { name: 'Changed service' });
    assert.equal(first.id, second.id); assert.equal(invoiceRows.length, 1);
    assert.equal(second.snapshot.service, 'Original service'); assert.equal(second.snapshot.servicePrice, 10000); assert.equal(second.snapshot.brand.businessName, 'Test Company');
});
test('invoice totals count only verified payments in the invoice currency and never treat no-advance-payment as free', () => {
    const snapshot = inv.snapshotFor({ ...booking, payment_mode: 'none', after_hours_fee: 1500 }, tenant);
    const totals = inv.invoiceTotals(snapshot, [{ status: 'pending', amount_due: 10000, currency: 'JMD' }, { status: 'paid', amount_due: 2500, currency: 'JMD' }, { status: 'paid', amount_due: 50, currency: 'USD' }]);
    assert.deepEqual(totals, { total: 11500, paid: 2500, balance: 9000, credit: 0 });
});
test('confirmation, pending-payment, pending-review and completion emails attach PDFs; only completion includes the private review invitation', async () => {
    await inv.ensureBookingInvoice(booking, tenant, { name: 'Original service' });
    for (const status of ['confirmed', 'pending_payment', 'pending_manual_confirmation', 'completed']) {
        mail = [];
        const current = { ...booking, status };
        if (status === 'confirmed') await email.sendBookingConfirmation(current, tenant);
        else if (status === 'completed') await email.sendBookingCompletedEmail(current, tenant);
        else await email.sendBookingPendingReviewEmail(current, tenant);
        const customerMessage = mail.find(m => m.to.includes(booking.email)); assert.ok(customerMessage, status);
        const pdf = customerMessage.attachments.find(a => a.filename.endsWith('.pdf')); assert.ok(pdf, status);
        assert.equal(pdf.content.subarray(0, 4).toString(), '%PDF');
        assert.equal(customerMessage.html.includes('#review='), status === 'completed');
        if (status === 'pending_payment') assert.match(customerMessage.subject, /Awaiting Payment/);
    }
});
test('phone booking invoices are downloadable even when no customer email exists', async () => {
    const invoice = await inv.ensureBookingInvoice({ ...booking, email: '', booking_source: 'phone' }, tenant, { name: 'Phone service' });
    assert.equal(invoice.snapshot.customer.email, '');
    const response = await request(`/invoices/${bookingId}/pdf`, null, auth('staff'), 'GET');
    assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /application\/pdf/);
});
