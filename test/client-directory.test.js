const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { PGlite } = require('@electric-sql/pglite');
const dbConnection = require('../server/db/connection');
const { listClients, clientProfile } = require('../server/services/clientDirectory');

process.env.ENCRYPTION_KEY ||= '11'.repeat(32);

const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const tenant = id(100);
const otherTenant = id(200);

test('client directory groups booking history, ranks completed services and protects tenant data', async t => {
    const db = new PGlite();
    t.after(() => db.close());
    const dbQuery = (sql, params) => db.query(sql, params);
    await db.exec(`
        CREATE TABLE bookings (
            id UUID PRIMARY KEY, tenant_id UUID, service_id UUID, name TEXT, email TEXT, phone TEXT,
            booking_date DATE, booking_time TIME, status TEXT, created_at TIMESTAMPTZ, booking_source TEXT
        );
        CREATE TABLE services (id UUID PRIMARY KEY, tenant_id UUID, name TEXT);
        CREATE TABLE booking_invoices (booking_id UUID, tenant_id UUID, snapshot JSONB);
        CREATE TABLE email_outbox (dedupe_key TEXT, status TEXT);
        CREATE TABLE booking_reschedules (
            id UUID, booking_id UUID, new_date DATE, new_time TIME, reason_code TEXT,
            reason TEXT, status TEXT, created_at TIMESTAMPTZ
        );
    `);
    await db.query('INSERT INTO services VALUES ($1,$2,$3),($4,$2,$5),($6,$7,$8)',
        [id(10), tenant, 'Cut', id(11), 'Wash', id(20), otherTenant, 'Other tenant service']);
    const bookings = [
        [1, tenant, id(10), 'A. Wright', ' AMBER@EXAMPLE.COM ', '+1 (876) 555-0100', -16, 'completed', 'online'],
        [2, tenant, id(10), 'Amber Wright', '', '876-555-0100', -15, 'completed', 'phone'],
        [3, tenant, id(11), 'Amber Wright', 'amber@example.com', '18765550100', -14, 'completed', 'online'],
        [4, tenant, id(11), 'Amber Wright', 'amber@example.com', '18765550100', -13, 'cancelled', 'online'],
        [5, tenant, id(11), 'Amber Wright', 'amber@example.com', '18765550100', -12, 'no_show', 'online'],
        [6, tenant, id(11), 'Amber Wright', 'amber@example.com', '18765550100', 2, 'confirmed', 'online'],
        [7, tenant, id(11), 'Bea Smith', 'bea@example.com', '18765550101', -5, 'completed', 'online'],
        [8, tenant, id(11), 'Cory Smith', 'cory@example.com', '18765550101', -4, 'pending_payment', 'online'],
        [9, tenant, null, 'Phone customer', '', '876 555 0101', -3, 'completed', 'phone'],
        [12, tenant, id(20), 'Legacy customer', '', '', -2, 'completed', 'phone'],
        [13, otherTenant, id(20), 'Other tenant client', 'amber@example.com', '18765550100', -1, 'completed', 'online']
    ];
    for (const [bookingId, ...values] of bookings) {
        await db.query(`INSERT INTO bookings VALUES ($1,$2,$3,$4,$5,$6,CURRENT_DATE + $7::int,'10:00',$8,
            NOW() + $7::int * INTERVAL '1 day',$9)`, [id(bookingId), ...values]);
    }
    await db.query('INSERT INTO booking_invoices VALUES ($1,$2,$3)', [id(9), tenant, JSON.stringify({ service: 'Retired style' })]);

    const directory = await listClients(dbQuery, tenant, { sort: 'visits' });
    assert.deepEqual(directory.overview, { clients: 5, returning: 1, visits: 6 });
    const amber = directory.clients[0];
    assert.equal(amber.id, id(6));
    assert.equal(amber.name, 'Amber Wright');
    assert.equal(amber.email, 'amber@example.com');
    assert.equal(amber.bookings, 6);
    assert.equal(amber.visits, 3);
    assert.equal(amber.top_service, 'Cut');
    const phoneOnly = directory.clients.find(item => item.id === id(9));
    assert.equal(phoneOnly.email, null);
    assert.equal(phoneOnly.top_service, 'Retired style');
    assert.equal(directory.clients.find(item => item.id === id(12)).top_service, null);
    assert.deepEqual((await listClients(dbQuery, tenant, { search: 'A. WRIGHT' })).clients.map(item => item.id), [id(6)]);
    assert.deepEqual((await listClients(dbQuery, tenant, { search: '+1 (876) 555-0100' })).clients.map(item => item.id), [id(6)]);
    assert.deepEqual((await listClients(dbQuery, tenant, { filter: 'returning' })).clients.map(item => item.id), [id(6)]);
    assert.equal((await listClients(dbQuery, tenant, { search: '%' })).total, 0);

    const profile = await clientProfile(dbQuery, tenant, id(1), 'America/Jamaica');
    assert.equal(profile.next_appointment.id, id(6));
    assert.equal(profile.client.cancellations, 1);
    assert.equal(profile.client.no_shows, 1);
    assert.deepEqual(profile.appointments.map(item => item.id), [6, 5, 4, 3, 2, 1].map(id));
    assert.deepEqual(profile.services, [{ name: 'Cut', visits: 2 }, { name: 'Wash', visits: 1 }]);
    assert.equal(await clientProfile(dbQuery, tenant, id(13), 'America/Jamaica'), null);
    assert.equal((await listClients(dbQuery, otherTenant)).clients[0].name, 'Other tenant client');

    const originalQuery = dbConnection.query;
    dbConnection.query = dbQuery;
    t.after(() => { dbConnection.query = originalQuery; });
    const { signToken } = require('../server/middleware/auth');
    const app = express();
    const tenantContext = (req, _res, next) => { req.tenant = { id: req.get('X-Tenant-ID') || tenant }; next(); };
    app.use('/clients', tenantContext, require('../server/routes/v1/clients'));
    app.use('/bookings', tenantContext, require('../server/routes/v1/bookings'));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const base = `http://127.0.0.1:${server.address().port}/clients`;
    const auth = (role = 'staff') => ({ Authorization: `Bearer ${signToken({ id: id(300), tenant_id: tenant, role })}` });
    assert.equal((await fetch(base)).status, 401);
    assert.equal((await fetch(base, { headers: auth('customer') })).status, 403);
    assert.equal((await fetch(base, { headers: { ...auth(), 'X-Tenant-ID': otherTenant } })).status, 403);
    assert.equal((await fetch(`${base}/${id(13)}`, { headers: auth() })).status, 404);
    assert.equal((await fetch(`${base}/invalid`, { headers: auth() })).status, 400);
    const response = await fetch(base, { headers: auth('tenant_admin') });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal((await response.json()).total, 5);

    const bookingUrl = new URL('/bookings', base);
    bookingUrl.searchParams.set('limit', '1');
    bookingUrl.searchParams.set('booking_id', id(1));
    const exact = await fetch(bookingUrl, { headers: auth() });
    assert.equal(exact.status, 200);
    assert.deepEqual((await exact.json()).bookings.map(booking => booking.id), [id(1)]);
    bookingUrl.searchParams.set('booking_id', id(13));
    assert.equal((await (await fetch(bookingUrl, { headers: auth() })).json()).total, 0);

    await db.query(`INSERT INTO bookings (id, tenant_id, name, email, booking_date, booking_time, status, created_at)
        SELECT gen_random_uuid(), $1, 'Extra client', n || '@example.net', CURRENT_DATE, '10:00', 'confirmed', NOW()
        FROM GENERATE_SERIES(1, 26) n`, [tenant]);
    const firstPage = await listClients(dbQuery, tenant);
    const secondPage = await listClients(dbQuery, tenant, { page: 2 });
    assert.equal(firstPage.total, 31);
    assert.equal(firstPage.clients.length, 25);
    assert.equal(secondPage.clients.length, 6);
    assert.equal(new Set([...firstPage.clients, ...secondPage.clients].map(client => client.id)).size, 31);
});
