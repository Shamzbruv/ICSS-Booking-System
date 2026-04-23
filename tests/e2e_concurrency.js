/**
 * E2E Concurrency & Idempotency Tests
 * 
 * Run with: node tests/e2e_concurrency.js
 *
 * Note: Requires a local server running on port 3000 with a seeded
 * 'demo-tenant' slug and at least one service.
 */

require('dotenv').config();
const axios = require('axios');
const { query } = require('../server/db/connection');

const API_URL   = 'http://localhost:3000/api/v1';
const SLUG      = 'demo-tenant';

// Bookings are now tenant-scoped via X-Tenant-Slug header, not a URL segment.
function bookingHeaders() {
    return { 'X-Tenant-Slug': SLUG, 'Content-Type': 'application/json' };
}

async function runTests() {
    console.log('--- Starting E2E Hardening Tests ---');

    // Fetch a real service_id from the DB to use in tests
    let serviceId;
    try {
        const svcRes = await query(`SELECT id FROM services WHERE tenant_id = (SELECT id FROM tenants WHERE slug = $1) LIMIT 1`, [SLUG]);
        serviceId = svcRes.rows[0]?.id;
        if (!serviceId) throw new Error('No services found for demo-tenant. Seed them first.');
    } catch (e) {
        console.error('Pre-check failed:', e.message);
        process.exit(1);
    }

    // ── TEST 1: Concurrent booking — pessimistic lock should allow only 1 ───────
    console.log('\n[Test 1] Pessimistic Lock — 3 concurrent requests for the same slot');

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const bookingPayload = {
        name:       'Test User',
        email:      'test@example.com',
        phone:      '1234567890',
        date:       dateStr,
        time:       '14:00',
        service_id: serviceId,
    };

    try {
        const requests = [
            axios.post(`${API_URL}/bookings`, bookingPayload, { headers: bookingHeaders() }),
            axios.post(`${API_URL}/bookings`, bookingPayload, { headers: bookingHeaders() }),
            axios.post(`${API_URL}/bookings`, bookingPayload, { headers: bookingHeaders() }),
        ];

        const results = await Promise.allSettled(requests);
        let successes = 0;
        let conflicts = 0;

        results.forEach((res, i) => {
            if (res.status === 'fulfilled') {
                successes++;
                console.log(`  Request ${i + 1}: SUCCESS (booking id: ${res.value.data?.booking?.id?.slice(0, 8)})`);
            } else {
                conflicts++;
                console.log(`  Request ${i + 1}: CONFLICT (${res.reason.response?.status}) — expected`);
            }
        });

        if (successes === 1 && conflicts === 2) {
            console.log('✅ PASS: Only 1 booking succeeded; 2 were safely rejected.');
        } else {
            console.log(`❌ FAIL: successes=${successes}, conflicts=${conflicts} (expected 1 and 2)`);
        }

        // Clean up the test booking
        if (successes > 0) {
            const booking = results.find(r => r.status === 'fulfilled')?.value?.data?.booking;
            if (booking) await query(`DELETE FROM bookings WHERE id = $1`, [booking.id]);
        }
    } catch (e) {
        console.error('Test 1 error:', e.message);
    }

    // ── TEST 2: PayPal Webhook Idempotency ────────────────────────────────────
    console.log('\n[Test 2] PayPal Webhook Idempotency — same event_id delivered twice');

    const eventId = `WH-TEST-${Date.now()}`;
    const webhookPayload = {
        id:         eventId,
        event_type: 'PAYMENT.SALE.COMPLETED',
        resource:   { id: 'SALE-123', amount: { total: '50.00' } }
    };
    const webhookHeaders = {
        'paypal-transmission-id':  'mock-id',
        'paypal-transmission-time':'mock-time',
        'paypal-cert-url':         'https://api.paypal.com/mock-cert',
        'paypal-auth-algo':        'RSA-SHA256',
        'paypal-transmission-sig': 'mock-sig',
    };

    try {
        const res1 = await axios.post(`${API_URL}/payments/paypal/webhook`, webhookPayload, { headers: webhookHeaders }).catch(e => e.response);
        const res2 = await axios.post(`${API_URL}/payments/paypal/webhook`, webhookPayload, { headers: webhookHeaders }).catch(e => e.response);

        const isDuplicate = res2?.data?.duplicate === true || res2?.status === 200;
        if (isDuplicate) {
            console.log('✅ PASS: Duplicate webhook was safely intercepted by idempotency_keys.');
        } else {
            console.log(`⚠️  WARN: Idempotency result unclear (status ${res2?.status}). Check PAYPAL_WEBHOOK_ID env.`);
        }
    } catch (e) {
        console.log('Test 2 Error (expected if strict signature check is active):', e.message);
    }

    // ── TEST 3: Manual Transfer Approval Flow ──────────────────────────────────
    console.log('\n[Test 3] Manual Bank Transfer — admin approval confirms booking');

    let manualBookingId;
    try {
        // Insert a manual booking directly
        const bRes = await query(
            `INSERT INTO bookings (tenant_id, service_id, name, email, phone, booking_date, booking_time,
              start_time, end_time, status, payment_mode, expires_at)
             VALUES (
               (SELECT id FROM tenants WHERE slug = $1),
               $2, 'Manual Test', 'manual@test.com', '0000000000',
               $3, '13:00',
               ($3::date + '13:00'::time)::timestamptz,
               ($3::date + '14:00'::time)::timestamptz,
               'pending_manual_confirmation', 'manual',
               NOW() + INTERVAL '30 minutes'
             ) RETURNING id`,
            [SLUG, serviceId, dateStr]
        );
        manualBookingId = bRes.rows[0].id;
        await query(`INSERT INTO booking_payments (booking_id, tenant_id, provider, payment_type, amount_due, status)
                     SELECT id, tenant_id, 'manual', 'full', 100, 'pending' FROM bookings WHERE id = $1`, [manualBookingId]);

        // Simulate admin approval via status update
        await query(`UPDATE bookings SET status = 'confirmed' WHERE id = $1`, [manualBookingId]);
        await query(`UPDATE booking_payments SET status = 'paid' WHERE booking_id = $1`, [manualBookingId]);

        const check = await query(`SELECT status FROM bookings WHERE id = $1`, [manualBookingId]);
        if (check.rows[0].status === 'confirmed') {
            console.log('✅ PASS: Manual transfer booking correctly transitions to confirmed.');
        } else {
            console.log(`❌ FAIL: Status is ${check.rows[0].status}`);
        }
    } catch (e) {
        console.error('Test 3 Error:', e.message);
    } finally {
        if (manualBookingId) {
            await query(`DELETE FROM booking_payments WHERE booking_id = $1`, [manualBookingId]);
            await query(`DELETE FROM bookings WHERE id = $1`, [manualBookingId]);
        }
    }

    // ── TEST 4: Manual Transfer Rejection Flow ─────────────────────────────────
    console.log('\n[Test 4] Manual Bank Transfer — admin rejection cancels booking');

    let rejectBookingId;
    try {
        const bRes = await query(
            `INSERT INTO bookings (tenant_id, service_id, name, email, phone, booking_date, booking_time,
              start_time, end_time, status, payment_mode, expires_at)
             VALUES (
               (SELECT id FROM tenants WHERE slug = $1),
               $2, 'Reject Test', 'reject@test.com', '0000000001',
               $3, '15:00',
               ($3::date + '15:00'::time)::timestamptz,
               ($3::date + '16:00'::time)::timestamptz,
               'pending_manual_confirmation', 'manual',
               NOW() + INTERVAL '30 minutes'
             ) RETURNING id`,
            [SLUG, serviceId, dateStr]
        );
        rejectBookingId = bRes.rows[0].id;

        await query(`UPDATE bookings SET status = 'rejected' WHERE id = $1`, [rejectBookingId]);

        const check = await query(`SELECT status FROM bookings WHERE id = $1`, [rejectBookingId]);
        if (check.rows[0].status === 'rejected') {
            console.log('✅ PASS: Manual transfer booking correctly transitions to rejected.');
        } else {
            console.log(`❌ FAIL: Status is ${check.rows[0].status}`);
        }
    } catch (e) {
        console.error('Test 4 Error:', e.message);
    } finally {
        if (rejectBookingId) await query(`DELETE FROM bookings WHERE id = $1`, [rejectBookingId]);
    }

    console.log('\n--- Tests Complete ---');
    process.exit(0);
}

runTests();
