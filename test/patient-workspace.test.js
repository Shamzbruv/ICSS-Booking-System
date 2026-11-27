const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const jwt = require('jsonwebtoken');
const database = require('../server/db/connection');
const { migratePatientWorkspace } = require('../server/db/patientWorkspace');

test('patient profiles are encrypted, tenant-scoped, and linked to bookings explicitly', async t => {
    const db = new PGlite();
    let server;
    t.after(async () => {
        if (server) await new Promise(resolve => server.close(resolve));
        await db.close();
    });
    await db.exec(`
        CREATE TABLE plans (id TEXT PRIMARY KEY, features JSONB, limits JSONB);
        CREATE TABLE themes (id UUID PRIMARY KEY, name TEXT);
        CREATE TABLE tenants (id UUID PRIMARY KEY, slug TEXT UNIQUE, active BOOLEAN DEFAULT true, plan_id TEXT,
            site_draft JSONB, site_config JSONB, site_previous_template JSONB,
            features JSONB, limits JSONB, theme_id UUID REFERENCES themes(id), is_test_account BOOLEAN DEFAULT false);
        CREATE TABLE users (id UUID PRIMARY KEY, tenant_id UUID, role TEXT, active BOOLEAN DEFAULT true);
        CREATE TABLE impersonation_sessions (id UUID PRIMARY KEY, mode TEXT, actor_user_id UUID,
            target_tenant_id UUID, revoked_at TIMESTAMPTZ, expires_at TIMESTAMPTZ);
        CREATE TABLE bookings (id UUID PRIMARY KEY, tenant_id UUID, name TEXT, email TEXT, phone TEXT,
            booking_date DATE, booking_time TIME, status TEXT, service_id UUID, notes TEXT);
        CREATE TABLE services (id UUID PRIMARY KEY, tenant_id UUID, name TEXT);
        CREATE TABLE audit_log (tenant_id UUID, user_id UUID, action TEXT, entity TEXT, entity_id TEXT);
    `);
    const schema = { query: sql => db.exec(sql) };
    await migratePatientWorkspace(schema);
    await migratePatientWorkspace(schema);
    const [first, second, owner, staff, other, appointment, otherAppointment, service, actor, session] =
        Array.from({ length:10 }, randomUUID);

    await db.query("INSERT INTO tenants (id,slug) VALUES ($1,'first'),($2,'second')", [first,second]);
    await db.query("INSERT INTO users (id,tenant_id,role) VALUES ($1,$4,'tenant_admin'),($2,$4,'staff'),($3,$5,'tenant_admin')",
        [owner,staff,other,first,second]);
    await db.query("INSERT INTO services VALUES ($1,$2,'Checkup')", [service,first]);
    await db.query(`INSERT INTO bookings (id,tenant_id,name,email,booking_date,booking_time,status,service_id,notes) VALUES
        ($1,$3,'Booking contact','family@example.test','2026-05-04','09:00','completed',$5,'Private booking note'),
        ($2,$4,'Second contact','family@example.test','2026-06-04','09:00','completed',NULL,NULL)`,
    [appointment,otherAppointment,first,second,service]);
    await db.query(`INSERT INTO impersonation_sessions (id,mode,actor_user_id,target_tenant_id,expires_at)
        VALUES ($1,'edit',$2,$3,NOW() + INTERVAL '1 hour')`, [session,actor,first]);

    t.mock.method(database,'query',(sql,params) => db.query(sql,params));
    t.mock.method(database,'transaction',callback => db.transaction(callback));
    process.env.ENCRYPTION_KEY ||= 'a'.repeat(64);
    const { app } = require('../server/app');
    server = app.listen(0,'127.0.0.1');
    await new Promise(resolve => server.once('listening',resolve));
    const url = 'http://127.0.0.1:' + server.address().port + '/api/v1/patients';
    const admin = { id:owner, role:'tenant_admin', tenant_id:first };
    const secondAdmin = { id:other,role:'tenant_admin',tenant_id:second };
    function request(path, { user = admin, slug = 'first', method = 'GET', body } = {}) {
        const secret = process.env.JWT_SECRET || 'dev_secret_change_in_production';
        return fetch(url + path,{method,body:body && JSON.stringify(body),headers:{
            ...(user && { Authorization:'Bearer ' + jwt.sign(user,secret) }), 'X-Tenant-Slug':slug,'Content-Type':'application/json'
        }});
    }

    const healthTheme = randomUUID();
    const generalTheme = randomUUID();
    await db.query("INSERT INTO themes VALUES ($1,'Serenity Health'),($2,'Universal Services')", [healthTheme,generalTheme]);
    const tenantApi = '/api/v1/tenants/first/theme';
    const apiOrigin = new URL(url).origin;
    const managerHeaders = {
        'Content-Type':'application/json','X-Tenant-Slug':'first',
        Authorization:'Bearer ' + jwt.sign(admin,process.env.JWT_SECRET || 'dev_secret_change_in_production')
    };
    const readTheme = async () => (await (await fetch(apiOrigin+tenantApi,{headers:managerHeaders})).json()).theme_key;
    const applyTheme = async themeId => {
        const response = await fetch(apiOrigin+tenantApi,{
            method:'POST', headers:managerHeaders, body:JSON.stringify({theme_id:themeId})
        });
        assert.equal(response.status,200);
        return (await response.json()).theme_key;
    };
    assert.equal(await readTheme(),'universal');
    assert.equal(await applyTheme(healthTheme),'health');
    assert.equal(await readTheme(),'health');
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0,10);
    const publicBooking = await fetch(apiOrigin+'/api/v1/bookings',{
        method:'POST', headers:{'Content-Type':'application/json','X-Tenant-Slug':'first'},
        body:JSON.stringify({name:'Sample Patient', email:'sample@example.test', phone:'8765551234',
            date:tomorrow, time:'12:00', service_id:service, terms_accepted:true, notes:'Sample text excluded from medical bookings.'})
    });
    assert.equal(publicBooking.status,400);
    assert.match((await publicBooking.json()).error,/medical bookings accept appointment details only/i);
    assert.equal(await applyTheme(generalTheme),'universal');
    assert.equal(await readTheme(),'universal');

    const search = (search, options = {}) => request('/search',{method:'POST',body:{search},...options});
    const create = (body,options = {}) => request('',{method:'POST',body,...options});
    assert.equal((await search('',{user:null})).status,401);
    assert.equal((await search('',{user:{id:staff,role:'staff',tenant_id:first}})).status,403);
    assert.equal((await search('',{user:{...admin,actor_user_id:actor,impersonation_session_id:session}})).status,403);
    assert.equal((await create({profile:null})).status,400);
    assert.equal((await create({profile:{name:'Sample Patient',birthDate:'2026-02-30'}})).status,400);
    const profile = {name:'Sample Patient',email:'FAMILY@example.test',birthDate:'2005-03-01',reference:'PR-01'};
    assert.equal((await create({profile,bookingId:otherAppointment})).status,404);
    assert.equal((await (await search('')).json()).patients.length,0);
    const requestId = randomUUID();
    const result = await create({profile,bookingId:appointment,requestId});
    assert.equal(result.status,201);
    assert.match(result.headers.get('cache-control'),/no-store/);
    const { id } = await result.json();
    assert.equal((await create({profile,bookingId:appointment,requestId})).status,200);

    const secondOpts = {user:secondAdmin,slug:'second'};
    assert.equal((await request('/'+id,secondOpts)).status,404);
    assert.equal((await (await search('sample patient',secondOpts)).json()).patients.length,0);
    const secondResponse = await create({profile},secondOpts);
    assert.equal(secondResponse.status,201);
    const encrypted = (await db.query('SELECT profile_ciphertext,lookup_keys FROM booking_patients')).rows;
    assert.equal(encrypted.length,2);
    assert.ok(encrypted.every(row => !row.profile_ciphertext.includes('Sample Patient')));
    assert.notDeepEqual(encrypted[0].lookup_keys,encrypted[1].lookup_keys);
    assert.deepEqual((await (await search(' FAMILY@EXAMPLE.TEST ')).json()).patients.map(patient => patient.id),[id]);

    const youngerPatient = await (await create({profile:{name:'Another Patient',email:'family@example.test'}})).json();
    assert.equal((await (await search('family@example.test')).json()).patients.length,2);
    const memberPath = '/bookings/'+appointment;
    assert.equal((await request(memberPath,{method:'PUT',body:{patientId:youngerPatient.id}})).status,409);
    assert.equal((await request(memberPath,{method:'PUT',body:{patientId:id}})).status,200);
    const details = await (await request('/'+id)).json();
    assert.equal(details.patient.birthDate,'2005-03-01');
    assert.equal(details.visits[0].service_name,'Checkup');
    assert.equal(details.visits[0].status,'completed');
    assert.equal(details.visits[0].notes,undefined);
    assert.equal((await request('/'+id,{method:'PATCH',body:{archived:true}})).status,200);
    assert.equal((await (await search('sample patient')).json()).patients.length,0);
    assert.equal((await (await request('/'+id)).json()).visits.length,1);
    assert.equal((await request('/'+id,{method:'PATCH',body:{archived:false}})).status,200);
    assert.equal((await request(memberPath,{method:'DELETE',body:{patientId:id}})).status,200);
    assert.equal((await (await request('/'+id)).json()).visits.length,0);
    assert.equal((await request(memberPath,{method:'PUT',body:{patientId:youngerPatient.id}})).status,200);

    await db.query('UPDATE users SET active=false WHERE id=$1',[owner]);
    assert.equal((await search('')).status,403);
    assert.equal((await db.query("SELECT 1 FROM audit_log WHERE action='patient.booking_unlinked'")).rows.length,1);
});
