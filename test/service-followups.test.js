const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const database = require('../server/db/connection');
const { migrateServiceFollowups } = require('../server/db/serviceFollowups');

test('service follow-ups use calendar intervals, skip rebooked clients and keep opt-outs across visits', async t => {
    const db = new PGlite();
    let server;
    t.after(async () => {
        if (server) await new Promise(resolve => server.close(resolve));
        await db.close();
    });
    await db.exec(`
        CREATE TABLE tenants (id UUID PRIMARY KEY, slug TEXT, name TEXT, active BOOLEAN DEFAULT true,
            branding JSONB, site_config JSONB, email_reply_to TEXT);
        CREATE TABLE users (id UUID PRIMARY KEY,tenant_id UUID,email TEXT,role TEXT,active BOOLEAN,created_at TIMESTAMPTZ);
        CREATE TABLE services (id UUID PRIMARY KEY,tenant_id UUID,name TEXT,active BOOLEAN DEFAULT true);
        CREATE TABLE bookings (id UUID PRIMARY KEY,tenant_id UUID,service_id UUID,email TEXT,status TEXT,
            booking_date DATE,booking_time TIME,start_time TIMESTAMPTZ);
    `);
    await migrateServiceFollowups(db);
    await migrateServiceFollowups(db);
    t.mock.method(database,'query',(sql,params) => db.query(sql,params));
    const { normalizeFollowup, enrollFollowup, listFollowups, processFollowup } = require('../server/services/serviceFollowups');
    const tenant = randomUUID();
    const service = randomUUID();
    await db.query("INSERT INTO tenants(id,slug,name,email_reply_to) VALUES ($1,'studio','Local Studio','team@example.com')",[tenant]);
    await db.query("INSERT INTO services(id,tenant_id,name) VALUES ($1,$2,'Maintenance')",[service,tenant]);

    const config = normalizeFollowup({enabled:true,interval:3,unit:'months',leadDays:7,reason:'A return visit helps us check <equipment>.'});
    assert.throws(() => normalizeFollowup({...config,unit:'days',interval:1,leadDays:2}),/valid follow-up interval/);
    await db.query('UPDATE services SET followup=$1 WHERE id=$2',[config,service]);
    const query = (sql,params) => db.query(sql,params);
    async function booking(email,date,status='completed') {
        const { rows } = await query(`
            INSERT INTO bookings VALUES ($1,$2,$3,$4,$5,$6,'10:00',$6::date::timestamp AT TIME ZONE 'America/Jamaica')
            RETURNING *`,[randomUUID(),tenant,service,email,status,date]);
        return rows[0];
    }

    const first = await booking('ALICE@EXAMPLE.COM','2025-01-31');
    await enrollFollowup(db,first);
    await enrollFollowup(db,first);
    const initial = await listFollowups(query,tenant,service,1);
    assert.equal(initial.clients.length,1);
    assert.equal(initial.clients[0].reminder_date,'2025-04-23');
    assert.deepEqual((await listFollowups(query,randomUUID(),service,1)).clients,[]);

    const delivered = [];
    const deliver = async mail => { delivered.push(mail); return {id:'provider-message'}; };
    await query("UPDATE services SET followup=followup || '{\"enabled\":false}' WHERE id=$1",[service]);
    assert.equal(await processFollowup(query,deliver),false);
    await query('UPDATE services SET followup=$1 WHERE id=$2',[config,service]);
    await Promise.all([processFollowup(query,deliver),processFollowup(query,deliver)]);
    assert.equal(delivered.length,1);
    assert.equal(delivered[0].brand.replyTo,'team@example.com');
    assert.match(delivered[0].html,/check &lt;equipment&gt;/);
    assert.match(delivered[0].html,/30 April 2025|April 30, 2025/);
    assert.match(delivered[0].html,new RegExp('service=' + service));
    assert.equal(delivered[0].headers['List-Unsubscribe-Post'],'List-Unsubscribe=One-Click');

    const repeat = await booking('alice@example.com','2025-05-01');
    await enrollFollowup(db,repeat);
    await enrollFollowup(db,first);
    assert.equal((await listFollowups(query,tenant,service,1)).clients[0].visit_date,'2025-05-01');

    const express = require('express');
    const app = express();
    app.use(express.urlencoded({extended:false}));
    app.use('/api/v1/service-followups',require('../server/routes/v1/serviceFollowups'));
    server = app.listen(0,'127.0.0.1');
    await new Promise(resolve => server.once('listening',resolve));
    const token = delivered[0].headers['List-Unsubscribe'].match(/unsubscribe\/([a-f0-9-]+)/)[1];
    const url = 'http://127.0.0.1:' + server.address().port + '/api/v1/service-followups/unsubscribe/' + token;
    assert.equal((await fetch(url)).status,200);
    assert.equal((await listFollowups(query,tenant,service,1)).clients[0].status,'scheduled');
    assert.equal((await fetch(url,{method:'POST',body:new URLSearchParams({'List-Unsubscribe':'One-Click'})})).status,200);
    await enrollFollowup(db,await booking('alice@example.com','2025-09-01'));
    assert.equal(await processFollowup(query,deliver),false);
    assert.equal((await listFollowups(query,tenant,service,1)).clients[0].status,'unsubscribed');

    await enrollFollowup(db,await booking('bob@example.com','2025-01-31'));
    await booking('bob@example.com','2099-01-01','confirmed');
    assert.equal(await processFollowup(query,deliver),true);
    assert.equal(delivered.length,1);
    const last = await listFollowups(query,tenant,service,1);
    assert.equal(last.clients.find(row => row.email==='bob@example.com').status,'skipped');
});
