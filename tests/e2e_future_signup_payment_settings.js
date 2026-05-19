/**
 * E2E Regression Test:
 * New tenant signup -> schedule + branding + manual bank transfer -> public booking flow
 *
 * Validates that future signups can immediately use business schedule,
 * booking-page branding, and tenant payment settings on the public booking page,
 * including receipt-required manual transfers.
 *
 * Run with: node tests/e2e_future_signup_payment_settings.js
 */

require('dotenv').config();
const assert = require('assert/strict');
const axios = require('axios');

const API_URL = 'http://localhost:3000/api/v1';
const CURRENT_TERMS_VERSION = '2026-05-05';
const TEST_RECEIPT_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==';
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isoDateDaysAhead(daysAhead) {
    const date = new Date();
    date.setDate(date.getDate() + daysAhead);
    return date.toISOString().slice(0, 10);
}

function dayNameFromIsoDate(dateString) {
    const date = new Date(`${dateString}T12:00:00`);
    return DAY_NAMES[date.getDay()];
}

function tenantHeaders(slug, token) {
    return {
        'X-Tenant-Slug': slug,
        ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
}

async function waitForProvisioning(signupToken, timeoutMs = 30000) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
        const res = await axios.get(`${API_URL}/public/provisioning-status/${signupToken}`);
        if (res.data.status === 'provisioned' && res.data.tenant_slug) {
            return res.data.tenant_slug;
        }
        if (res.data.status === 'failed') {
            throw new Error('Provisioning job reported failed status.');
        }
        await sleep(1500);
    }

    throw new Error(`Provisioning did not complete within ${timeoutMs}ms.`);
}

async function findBookableSlot(slug, serviceId) {
    for (let dayOffset = 1; dayOffset <= 7; dayOffset += 1) {
        const date = isoDateDaysAhead(dayOffset);
        const res = await axios.get(`${API_URL}/availability`, {
            params: { date, service_id: serviceId },
            headers: tenantHeaders(slug)
        });

        const slot = (res.data.slots || []).find((entry) => entry.available);
        if (slot) {
            return { date, time: slot.time };
        }
    }

    throw new Error('No bookable slot found within the next 7 days.');
}

async function run() {
    console.log('--- Starting Future Signup Payment Settings Regression Test ---');

    const timestamp = Date.now();
    const tenantName = `Future Signup Studio ${timestamp}`;
    const adminEmail = `future_signup_${timestamp}@e2etest.com`;
    const adminPassword = 'Password123!';
    const serviceName = `Manual Deposit Service ${timestamp}`;
    const bankInstructions = `Send bank transfer and upload your receipt. Ref ${timestamp}`;
    const sharedImage = TEST_RECEIPT_DATA_URL;
    const openDate = isoDateDaysAhead(1);
    const closedDate = isoDateDaysAhead(2);
    const openDay = dayNameFromIsoDate(openDate);
    const closedDay = dayNameFromIsoDate(closedDate);
    const brandingPayload = {
        logoUrl: sharedImage,
        serviceSectionImageUrl: sharedImage,
        bookingTagline: `Signature bookings ${timestamp}`,
        bookingFooterNote: `Footer note ${timestamp}`,
        location: `Kingston ${timestamp}`,
        badge1: `Priority ${timestamp}`,
        badge2: `VIP ${timestamp}`,
        timezone: 'America/Jamaica',
        stylists: ['Maya', 'Jordan']
    };
    const businessHours = Object.fromEntries(
        DAY_NAMES.map((day) => [day, {
            active: false,
            is24Hours: false,
            open: '09:00',
            close: '17:00'
        }])
    );
    businessHours[openDay] = {
        active: true,
        is24Hours: false,
        open: '10:00',
        close: '14:00'
    };

    console.log('\n[Step 1] Create pending signup...');
    const signupRes = await axios.post(`${API_URL}/payments/paypal/create-subscription`, {
        tenant_name: tenantName,
        admin_email: adminEmail,
        admin_password: adminPassword,
        plan_id: 'pro',
        theme_id: null,
        terms_accepted: true,
        terms_version: CURRENT_TERMS_VERSION
    });
    const signupToken = signupRes.data.signup_token;
    assert.ok(signupToken, 'Signup token should be returned.');
    console.log(`✅ Pending signup created: ${signupToken}`);

    console.log('\n[Step 2] Trigger provisioning...');
    await axios.post(`${API_URL}/payments/paypal/approve`, {
        signup_token: signupToken,
        subscription_id: `TEST-SUB-${timestamp}`
    });

    const tenantSlug = await waitForProvisioning(signupToken);
    assert.ok(tenantSlug, 'Provisioned tenant slug should be returned.');
    console.log(`✅ Tenant provisioned: ${tenantSlug}`);

    console.log('\n[Step 3] Log in as the new tenant admin...');
    const loginRes = await axios.post(`${API_URL}/auth/login`, {
        email: adminEmail,
        password: adminPassword
    });
    const token = loginRes.data.token;
    assert.ok(token, 'Tenant admin JWT should be returned.');
    console.log('✅ Tenant admin login succeeded.');

    console.log('\n[Step 4] Save booking page branding...');
    await axios.patch(`${API_URL}/tenants/${tenantSlug}/branding`, brandingPayload, {
        headers: tenantHeaders(tenantSlug, token)
    });
    console.log('✅ Branding saved.');

    console.log('\n[Step 5] Verify public branding updates immediately...');
    const brandingRes = await axios.get(`${API_URL}/public/tenant`, {
        headers: tenantHeaders(tenantSlug)
    });
    assert.equal(brandingRes.data.branding.logoUrl, brandingPayload.logoUrl);
    assert.equal(brandingRes.data.branding.serviceSectionImageUrl, brandingPayload.serviceSectionImageUrl);
    assert.equal(brandingRes.data.branding.bookingTagline, brandingPayload.bookingTagline);
    assert.equal(brandingRes.data.branding.bookingFooterNote, brandingPayload.bookingFooterNote);
    assert.equal(brandingRes.data.branding.location, brandingPayload.location);
    assert.equal(brandingRes.data.branding.badge1, brandingPayload.badge1);
    assert.equal(brandingRes.data.branding.badge2, brandingPayload.badge2);
    assert.equal(brandingRes.data.branding.timezone, brandingPayload.timezone);
    assert.deepEqual(brandingRes.data.branding.stylists, brandingPayload.stylists);
    assert.match(brandingRes.headers['cache-control'] || '', /no-store/i);
    assert.match(brandingRes.headers['vary'] || '', /x-tenant-slug/i);
    console.log('✅ Public branding payload reflects the saved branding.');

    console.log('\n[Step 6] Save business schedule...');
    await axios.patch(`${API_URL}/tenants/${tenantSlug}/payment-settings`, {
        business_hours: businessHours
    }, {
        headers: tenantHeaders(tenantSlug, token)
    });
    console.log('✅ Schedule saved.');

    console.log('\n[Step 7] Verify availability reflects the saved schedule immediately...');
    const openAvailabilityRes = await axios.get(`${API_URL}/availability`, {
        params: { date: openDate },
        headers: tenantHeaders(tenantSlug)
    });
    const closedAvailabilityRes = await axios.get(`${API_URL}/availability`, {
        params: { date: closedDate },
        headers: tenantHeaders(tenantSlug)
    });
    const openAvailableSlots = (openAvailabilityRes.data.slots || []).filter((slot) => slot.available);
    assert.equal(openAvailabilityRes.data.dayBlocked, undefined);
    assert.ok(openAvailableSlots.some((slot) => slot.time === '10:00'));
    assert.ok(openAvailableSlots.every((slot) => slot.time >= '10:00' && slot.time < '14:00'));
    assert.equal(closedAvailabilityRes.data.dayBlocked, true);
    assert.match(closedAvailabilityRes.data.message || '', /closed/i);
    assert.match(openAvailabilityRes.headers['cache-control'] || '', /no-store/i);
    assert.match(openAvailabilityRes.headers['vary'] || '', /x-tenant-slug/i);
    console.log('✅ Availability now matches the saved business schedule.');

    console.log('\n[Step 8] Save manual bank transfer settings...');
    await axios.patch(`${API_URL}/tenants/${tenantSlug}/payment-settings`, {
        default_payment_mode: 'manual',
        manual_payment_enabled: true,
        wipay_enabled: false,
        hold_timeout_minutes: 15,
        bank_transfer_instructions: bankInstructions
    }, {
        headers: tenantHeaders(tenantSlug, token)
    });
    console.log('✅ Payment settings saved.');

    console.log('\n[Step 9] Verify public tenant payment settings update immediately...');
    const tenantRes = await axios.get(`${API_URL}/public/tenant`, {
        headers: tenantHeaders(tenantSlug)
    });
    assert.equal(tenantRes.data.default_payment_mode, 'manual');
    assert.equal(tenantRes.data.manual_payment_enabled, true);
    assert.equal(tenantRes.data.bank_transfer_instructions, bankInstructions);
    assert.match(tenantRes.headers['cache-control'] || '', /no-store/i);
    assert.match(tenantRes.headers['vary'] || '', /x-tenant-slug/i);
    console.log('✅ Public tenant payload reflects the saved payment settings.');

    console.log('\n[Step 10] Create a service that uses business payment defaults...');
    const serviceRes = await axios.post(`${API_URL}/services`, {
        name: serviceName,
        price: 2000,
        currency: 'JMD',
        duration_minutes: 30,
        buffer_time_minutes: 0,
        payment_mode: 'tenant_default',
        payment_requirement_type: 'deposit',
        deposit_type: 'percentage',
        deposit_amount: 30,
        description: 'Regression test service'
    }, {
        headers: tenantHeaders(tenantSlug, token)
    });
    const serviceId = serviceRes.data.service?.id;
    assert.ok(serviceId, 'Created service id should be returned.');
    console.log('✅ Tenant-default deposit service created.');

    console.log('\n[Step 11] Verify public services are tenant-scoped and uncached...');
    const publicServicesRes = await axios.get(`${API_URL}/public/services`, {
        headers: tenantHeaders(tenantSlug)
    });
    const publicService = (publicServicesRes.data.services || []).find((service) => service.id === serviceId);
    assert.ok(publicService, 'Created service should be visible on the public booking page.');
    assert.equal(publicService.payment_mode, 'tenant_default');
    assert.equal(publicService.payment_requirement_type, 'deposit');
    assert.equal(publicService.deposit_type, 'percentage');
    assert.equal(Number(publicService.deposit_amount), 30);
    assert.match(publicServicesRes.headers['cache-control'] || '', /no-store/i);
    assert.match(publicServicesRes.headers['vary'] || '', /x-tenant-slug/i);
    console.log('✅ Public services payload is correct.');

    console.log('\n[Step 12] Find a live bookable slot...');
    const slot = await findBookableSlot(tenantSlug, serviceId);
    assert.ok(slot.date && slot.time, 'A valid booking slot should be found.');
    assert.equal(slot.date, openDate);
    console.log(`✅ Found slot ${slot.date} ${slot.time}`);

    console.log('\n[Step 13] Ensure receipt is required for manual-transfer bookings...');
    try {
        await axios.post(`${API_URL}/bookings`, {
            service_id: serviceId,
            date: slot.date,
            time: slot.time,
            name: 'Receipt Missing Test',
            email: `receipt_missing_${timestamp}@example.com`,
            phone: '876-555-0100',
            notes: 'Should fail because no receipt is attached.'
        }, {
            headers: tenantHeaders(tenantSlug)
        });
        throw new Error('Booking unexpectedly succeeded without a receipt.');
    } catch (err) {
        const message = err.response?.data?.error || err.message;
        assert.match(message, /receipt/i);
        console.log('✅ Booking is blocked without a receipt.');
    }

    console.log('\n[Step 14] Submit booking with bank transfer receipt...');
    const bookingRes = await axios.post(`${API_URL}/bookings`, {
        service_id: serviceId,
        date: slot.date,
        time: slot.time,
        name: 'Receipt Attached Test',
        email: `receipt_attached_${timestamp}@example.com`,
        phone: '876-555-0101',
        notes: 'Should succeed with receipt attached.',
        receipt_image: TEST_RECEIPT_DATA_URL
    }, {
        headers: tenantHeaders(tenantSlug)
    });

    assert.equal(bookingRes.data.booking?.status, 'pending_manual_confirmation');
    console.log('✅ Booking entered pending manual confirmation as expected.');

    console.log('\n🎉 Future signup manual-transfer regression test passed.');
}

run().catch((err) => {
    console.error('\n❌ Future signup payment settings regression failed.');
    console.error(err.response?.data || err.stack || err.message);
    process.exit(1);
});
