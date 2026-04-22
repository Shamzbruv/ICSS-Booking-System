/**
 * E2E Concurrency & Idempotency Tests (Phase 3 Hardening)
 * 
 * Run with: node tests/e2e_concurrency.js
 */

require('dotenv').config();
const { query } = require('../server/db/connection');
const axios = require('axios');

const API_URL = 'http://localhost:3000/api/v1';

async function runTests() {
    console.log('--- Starting E2E Hardening Tests ---');

    // TEST 1: Double-Booking Concurrency Lock
    console.log('\n[Test 1] Testing Pessimistic Locking (SELECT FOR UPDATE) on Bookings...');
    
    // Attempt to fire 3 concurrent booking requests for the EXACT same slot
    const tenantSlug = 'demo-tenant'; // Assume this exists in DB
    const bookingPayload = {
        name: 'Test User',
        email: 'test@example.com',
        phone: '1234567890',
        date: '2026-05-01',
        time: '10:00',
        service: 'Test Service'
    };

    try {
        const requests = [
            axios.post(`${API_URL}/tenants/${tenantSlug}/bookings`, bookingPayload),
            axios.post(`${API_URL}/tenants/${tenantSlug}/bookings`, bookingPayload),
            axios.post(`${API_URL}/tenants/${tenantSlug}/bookings`, bookingPayload)
        ];

        const results = await Promise.allSettled(requests);
        
        let successes = 0;
        let conflicts = 0;

        results.forEach((res, i) => {
            if (res.status === 'fulfilled') {
                successes++;
                console.log(`Request ${i + 1}: SUCCESS`);
            } else {
                conflicts++;
                console.log(`Request ${i + 1}: FAILED (Status ${res.reason.response?.status}) - Expected Conflict`);
            }
        });

        if (successes === 1 && conflicts === 2) {
            console.log('✅ PASS: Only one booking succeeded, the others were safely locked out.');
        } else {
            console.log('❌ FAIL: Concurrency lock failed or unexpected results.');
        }

    } catch (e) {
        console.log('Test 1 setup error:', e.message);
    }

    // TEST 2: Webhook Idempotency
    console.log('\n[Test 2] Testing PayPal Webhook Idempotency...');
    const webhookPayload = {
        id: `WH-${Date.now()}`,
        event_type: 'PAYMENT.SALE.COMPLETED',
        resource: { id: 'SALE-123', amount: { total: '50.00' } }
    };

    try {
        console.log('Firing first webhook...');
        const res1 = await axios.post(`${API_URL}/payments/paypal/webhook`, webhookPayload, {
            // Mocking the CRC32 valid signature for dev mode
            headers: {
                'paypal-transmission-id': 'mock-id',
                'paypal-transmission-time': 'mock-time',
                'paypal-cert-url': 'https://api.paypal.com/mock-cert',
                'paypal-auth-algo': 'RSA-SHA256',
                'paypal-transmission-sig': 'mock-sig'
            }
        });
        console.log('Response 1:', res1.data);

        console.log('Firing DUPLICATE webhook immediately...');
        const res2 = await axios.post(`${API_URL}/payments/paypal/webhook`, webhookPayload, {
             headers: {
                'paypal-transmission-id': 'mock-id',
                'paypal-transmission-time': 'mock-time',
                'paypal-cert-url': 'https://api.paypal.com/mock-cert',
                'paypal-auth-algo': 'RSA-SHA256',
                'paypal-transmission-sig': 'mock-sig'
            }
        });
        console.log('Response 2:', res2.data);

        if (res2.data.duplicate === true) {
            console.log('✅ PASS: Duplicate webhook intercepted by idempotency_keys table.');
        } else {
            console.log('❌ FAIL: Idempotency failed to catch duplicate.');
        }

    } catch (e) {
        // Will fail signature check unless process.env.PAYPAL_WEBHOOK_ID is null/mocked
        console.log('Test 2 Error (Likely Expected if strict signature check active):', e.message);
    }

    console.log('\n--- Tests Complete ---');
    process.exit(0);
}

// runTests();
