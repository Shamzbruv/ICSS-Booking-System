const {PGlite}=require('@electric-sql/pglite');const fs=require('fs');const assert=require('assert/strict');
require('node:test')('WhatsApp database lifecycle: durable events, consent, callbacks and duplicate protection',async()=>{
const root=require('path').resolve(__dirname,'..');const db=new PGlite();
await db.exec(`CREATE TABLE tenants(id UUID PRIMARY KEY,name TEXT);CREATE TABLE services(id UUID PRIMARY KEY,name TEXT);CREATE TABLE bookings(id UUID PRIMARY KEY,tenant_id UUID REFERENCES tenants,service_id UUID REFERENCES services,name TEXT,phone TEXT,booking_date DATE,booking_time TIME,start_time TIMESTAMPTZ,status TEXT,whatsapp_opt_in BOOLEAN);`);
const existing='55555555-5555-4555-8555-555555555555';await db.query('INSERT INTO tenants VALUES($1,$2)',[existing,'Existing business']);
const src=fs.readFileSync(root+'/server/db/connection.js','utf8').split('await client.query(`CREATE TABLE IF NOT EXISTS whatsapp_settings')[1];const sqls=[...('await client.query(`CREATE TABLE IF NOT EXISTS whatsapp_settings'+src).matchAll(/await client.query\(`([\s\S]*?)`\);/g)].map(m=>m[1]);for(const sql of sqls){await db.exec(sql);if(sql.startsWith('CREATE TABLE IF NOT EXISTS whatsapp_preferences'))await db.query('INSERT INTO whatsapp_preferences(tenant_id,enabled) VALUES($1,false)',[existing]);}
assert.equal((await db.query('SELECT enabled FROM whatsapp_preferences WHERE tenant_id=$1',[existing])).rows[0].enabled,true);
// Repeat migration: a subsequently disabled business stays disabled.
await db.query('UPDATE whatsapp_preferences SET enabled=false WHERE tenant_id=$1',[existing]);for(const sql of sqls)await db.exec(sql);
assert.equal((await db.query('SELECT enabled FROM whatsapp_preferences WHERE tenant_id=$1',[existing])).rows[0].enabled,false);
const query=(sql,args)=>db.query(sql,args);const modulePath=require.resolve(root+'/server/db/connection');require.cache[modulePath]={id:modulePath,filename:modulePath,loaded:true,exports:{query,transaction:async f=>{await db.exec('BEGIN');try{const r=await f({query});await db.exec('COMMIT');return r;}catch(e){await db.exec('ROLLBACK');throw e;}}}};
process.env.ENCRYPTION_KEY='ab'.repeat(32);process.env.BASE_URL='https://icssbookings.com';let sent=[];
const ax=require.resolve('axios');require.cache[ax]={id:ax,filename:ax,loaded:true,exports:async o=>{sent.push(new URLSearchParams(o.data));return {data:{sid:'SM'+String(sent.length).padStart(32,'0'),status:'queued'}};}};
const wa=require(root+'/server/services/whatsapp');await wa.saveConfig({sid:'AC'+'a'.repeat(32),token:'secret',from:'+16676604341',enabled:true});
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
await db.close();
});
