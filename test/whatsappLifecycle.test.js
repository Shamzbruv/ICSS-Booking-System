const {PGlite}=require('@electric-sql/pglite');const fs=require('fs');const assert=require('assert/strict');
require('node:test')('WhatsApp database lifecycle: durable events, consent, callbacks and duplicate protection',async()=>{
const root=require('path').resolve(__dirname,'..');const db=new PGlite();
await db.exec(`CREATE TABLE tenants(id UUID PRIMARY KEY,name TEXT);CREATE TABLE services(id UUID PRIMARY KEY,name TEXT);CREATE TABLE bookings(id UUID PRIMARY KEY,tenant_id UUID REFERENCES tenants,service_id UUID REFERENCES services,name TEXT,phone TEXT,booking_date DATE,booking_time TIME,start_time TIMESTAMPTZ,status TEXT,whatsapp_opt_in BOOLEAN);`);
const existing='55555555-5555-4555-8555-555555555555';await db.query('INSERT INTO tenants VALUES($1,$2)',[existing,'Existing business']);
const src=fs.readFileSync(root+'/server/db/connection.js','utf8').split('await client.query(`CREATE TABLE IF NOT EXISTS whatsapp_settings')[1];const sqls=[...('await client.query(`CREATE TABLE IF NOT EXISTS whatsapp_settings'+src).matchAll(/await client.query\(`([\s\S]*?)`\);/g)].map(m=>m[1]);
const previousConfig = { enabled: true, token: 'existing-encrypted-token', sender_sid: 'XEexisting' };
for (const sql of sqls) {
    await db.exec(sql);
    if (sql.startsWith('CREATE TABLE IF NOT EXISTS whatsapp_settings')) {
        await db.query('INSERT INTO whatsapp_settings(id,config) VALUES(1,$1)', [JSON.stringify(previousConfig)]);
    }
    if (sql.startsWith('CREATE TABLE IF NOT EXISTS whatsapp_preferences')) {
        await db.query('INSERT INTO whatsapp_preferences(tenant_id,enabled) VALUES($1,false)', [existing]);
    }
}
assert.deepEqual((await db.query('SELECT config FROM whatsapp_settings')).rows[0].config, { ...previousConfig, enabled: false });
await db.query('DELETE FROM whatsapp_settings WHERE id=1');
assert.equal((await db.query('SELECT enabled FROM whatsapp_preferences WHERE tenant_id=$1',[existing])).rows[0].enabled,true);
// Repeat migration: a subsequently disabled business stays disabled.
await db.query('UPDATE whatsapp_preferences SET enabled=false WHERE tenant_id=$1',[existing]);for(const sql of sqls)await db.exec(sql);
assert.equal((await db.query('SELECT enabled FROM whatsapp_preferences WHERE tenant_id=$1',[existing])).rows[0].enabled,false);
const query=(sql,args)=>db.query(sql,args);const modulePath=require.resolve(root+'/server/db/connection');require.cache[modulePath]={id:modulePath,filename:modulePath,loaded:true,exports:{query,transaction:async f=>{await db.exec('BEGIN');try{const r=await f({query});await db.exec('COMMIT');return r;}catch(e){await db.exec('ROLLBACK');throw e;}}}};
process.env.ENCRYPTION_KEY='ab'.repeat(32);process.env.BASE_URL='https://icssbookings.com';let sent=[];
const ax=require.resolve('axios');
let senderStatus = 'ONLINE';
require.cache[ax]={id:ax,filename:ax,loaded:true,exports:async o=>{
    if (o.url.startsWith('https://messaging.twilio.com/')) {
        return { data: { senders: [{ sid: 'XE'+'a'.repeat(32), sender_id: 'whatsapp:+16676604341', status: senderStatus }] } };
    }
    sent.push(new URLSearchParams(o.data));return {data:{sid:'SM'+String(sent.length).padStart(32,'0'),status:'queued'}};
}};
const wa=require(root+'/server/services/whatsapp');
const connection = {sid:'AC'+'a'.repeat(32),token:'secret',from:'+16676604341'};
await wa.saveConfig({...connection, enabled: true});
assert.equal((await wa.config()).enabled, false);
await wa.setEnabled(true);
for (const sql of sqls) await db.exec(sql);
assert.equal((await wa.config()).enabled, true);
const tid='11111111-1111-4111-8111-111111111111';await query('INSERT INTO tenants VALUES($1,$2)',[tid,'Studio']);assert.equal((await query('SELECT enabled FROM whatsapp_preferences WHERE tenant_id=$1',[tid])).rows[0].enabled,true);await query(`INSERT INTO whatsapp_preferences(tenant_id,enabled,providers) VALUES($1,true,$2) ON CONFLICT(tenant_id) DO UPDATE SET providers=$2`,[tid,JSON.stringify([{name:'Alex',phone:'+18765825685',opt_in:true}])]);
const bid='22222222-2222-4222-8222-222222222222';await query(`INSERT INTO bookings VALUES($1,$2,NULL,'Jane','+18765551234','2026-11-15','10:00','2026-11-15T15:00Z','pending_payment',true)`,[bid,tid]);await wa.tick();assert.equal(sent.length,2);assert.equal(sent[0].get('ContentSid'),wa.TEMPLATES.request);assert.equal(JSON.parse(sent[0].get('ContentVariables'))['6'],bid);await wa.tick();assert.equal(sent.length,2);
await query(`UPDATE bookings SET status='confirmed' WHERE id=$1`,[bid]);await wa.tick();assert.equal(sent.length,3);assert.equal(sent[2].get('ContentSid'),wa.TEMPLATES.confirmation);
await query(`UPDATE bookings SET booking_date='2026-11-16',start_time='2026-11-16T15:00Z' WHERE id=$1`,[bid]);await wa.tick();assert.equal(sent.length,5);
await query(`UPDATE bookings SET status='cancelled' WHERE id=$1`,[bid]);await wa.tick();assert.equal(sent.length,7);await wa.tick();assert.equal(sent.length,7);
const saved=(await query('SELECT config FROM whatsapp_settings')).rows[0].config;assert.notEqual(saved.token,'secret');
console.log('PASS: migrations, transactional event trigger, pending/confirmed/reschedule/cancellation fanout, deduplication, encrypted storage');
// Invalid webhook signatures must never modify opt-out state.
let code;const response={sendStatus:c=>{code=c;},type(){return this;},send(){}};
await wa.webhook({body:{Body:'STOP',From:'whatsapp:+18765551234'},get:()=>''},response);assert.equal(code,403);
const body={Body:'STOP',From:'whatsapp:+18765551234'};const url=process.env.BASE_URL+'/api/v1/whatsapp/webhook';const signature=require('crypto').createHmac('sha1','secret').update(url+Object.keys(body).sort().map(k=>k+body[k]).join('')).digest('base64');
await wa.webhook({body,get:()=>signature},response);assert.equal((await query('SELECT * FROM whatsapp_optouts')).rows.length,1);
// A new consent checkbox cannot override a recipient STOP suppression.
const next='33333333-3333-4333-8333-333333333333';await query(`INSERT INTO bookings VALUES($1,$2,NULL,'Jane','+18765551234','2026-11-15','10:00','2026-11-15T15:00Z','confirmed',true)`,[next,tid]);await wa.tick();assert.equal(sent.length,8); // provider only
// Enabling a business never sends a backlog of events captured while disabled.
await query('UPDATE whatsapp_preferences SET enabled=false WHERE tenant_id=$1',[tid]);
const old='44444444-4444-4444-8444-444444444444';await query(`INSERT INTO bookings VALUES($1,$2,NULL,'Jane','+18765558888','2026-11-15','10:00','2026-11-15T15:00Z','confirmed',true)`,[old,tid]);
await query('UPDATE whatsapp_preferences SET enabled=true,enabled_at=NOW() WHERE tenant_id=$1',[tid]);await wa.tick();assert.equal(sent.length,8);
// A global pause removes public eligibility and prevents old pending messages from replaying.
const queued = (await query("SELECT id,event_id FROM whatsapp_deliveries WHERE booking_id=$1 LIMIT 1", [next])).rows[0];
await query("UPDATE whatsapp_deliveries SET status='pending' WHERE id=$1", [queued.id]);
await wa.setEnabled(false);
const { getWhatsAppPreferences } = require(root+'/server/services/whatsappPreferences');
assert.equal((await getWhatsAppPreferences(tid)).platform_enabled, false);
const express = require('express');
const app = express();
app.use(express.json());
app.use((req, res, next) => { req.user = { role: req.get('X-Test-Role') }; next(); });
app.use(require(root+'/server/routes/v1/whatsappPlatform'));
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const change = (role, enabled) => fetch(origin+'/enabled', {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-Test-Role': role },
        body: JSON.stringify({ enabled })
    });
    assert.equal((await change('developer_admin', true)).status, 403);
    assert.equal((await change('platform_owner', 'true')).status, 400);
    const off = await change('platform_owner', false);
    assert.deepEqual(await off.json(), { enabled: false });
    const testSend = await fetch(origin+'/test-message', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Test-Role': 'platform_owner' },
        body: JSON.stringify({ phone: '+18765558888', consent: true })
    });
    assert.equal(testSend.status, 409);
} finally {
    await new Promise(resolve => server.close(resolve));
}
const duringPause = '66666666-6666-4666-8666-666666666666';
await query(`INSERT INTO bookings VALUES($1,$2,NULL,'Test','+18765558888','2026-11-15','10:00','2026-11-15T15:00Z','confirmed',true)`, [duringPause, tid]);
assert.equal((await query('SELECT id FROM whatsapp_events WHERE booking_id=$1', [duringPause])).rows.length, 0);
await wa.tick();
assert.equal(sent.length, 8);
const pausedConfig = await wa.config();
await wa.saveConfig({ ...connection, token: '', enabled: true });
assert.equal((await wa.config()).enabled, false);
assert.equal((await wa.config()).webhook_configured_at, pausedConfig.webhook_configured_at);
senderStatus = 'OFFLINE';
await assert.rejects(wa.setEnabled(true), /not online/);
assert.equal((await wa.config()).enabled, false);
senderStatus = 'ONLINE';
await wa.setEnabled(true);
assert.equal((await getWhatsAppPreferences(tid)).platform_enabled, true);
await wa.tick();
assert.equal(sent.length, 8);
assert.equal((await query('SELECT status FROM whatsapp_deliveries WHERE id=$1', [queued.id])).rows[0].status, 'skipped');
await db.close();
});
