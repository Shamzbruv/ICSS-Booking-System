const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const jwt = require('jsonwebtoken');
const database = require('../server/db/connection');
const { migrateSiteTemplates } = require('../server/db/siteTemplates');

test('template repair, apply and restore keep public and editor state in sync', async t => {
    const db = new PGlite();
    let server;
    t.after(async () => {
        if (server) await new Promise(resolve => server.close(resolve));
        await db.close();
    });
    await db.exec(`
        CREATE TABLE themes (id UUID PRIMARY KEY, name TEXT, category TEXT, template_path TEXT);
        CREATE TABLE plans (id TEXT PRIMARY KEY, features JSONB, limits JSONB);
        CREATE TABLE tenants (id UUID PRIMARY KEY, slug TEXT UNIQUE, name TEXT, active BOOLEAN DEFAULT true, plan_id TEXT,
            features JSONB, limits JSONB, theme_id UUID REFERENCES themes(id), is_test_account BOOLEAN DEFAULT false,
            site_draft JSONB, site_config JSONB, site_published_at TIMESTAMPTZ, updated_at TIMESTAMPTZ);
        CREATE TABLE newsletter_settings (tenant_id UUID, enabled BOOLEAN);
    `);
    const [tenantId, retailId, barber, rental, driving, userId] = Array.from({ length:6 }, randomUUID);
    await db.query(`INSERT INTO themes VALUES ($1,'Iron & Blade','Barber','/demo/barber'),
        ($2,'Island Drive Rentals','Car Rental','/demo/car-rental'),($3,'Harbour Driving School','Driving','/demo/driving-lessons')`,
    [barber,rental,driving]);
    const old = {pages:[{id:'home',sections:[{type:'hero',props:{headline:'Sharp cuts.\nZero shortcuts.'}}]}]};
    const draft = {brand:{name:'Existing draft'}};
    await db.query(`INSERT INTO tenants (id,slug,name,theme_id,is_test_account,site_config,site_draft) VALUES
        ($1,'icreate-testing-account','Testing Account',$3,true,$4,$5), ($2,'retail','Retail',$3,false,$4,$5)`,
    [tenantId,retailId,rental,old,draft]);
    const schema = { query:(sql,params) => params ? db.query(sql,params) : db.exec(sql) };
    await migrateSiteTemplates(schema);
    await migrateSiteTemplates(schema);
    const { rows:[repaired] } = await db.query('SELECT site_config, site_previous_template FROM tenants WHERE id=$1',[tenantId]);
    assert.equal(repaired.site_config,null);
    assert.deepEqual(repaired.site_previous_template.site_config,old);
    assert.equal((await db.query('SELECT site_config FROM tenants WHERE id=$1',[retailId])).rows[0].site_config.pages[0].id,'home');

    t.mock.method(database,'query',(sql,params) => db.query(sql,params));
    t.mock.method(database,'transaction',callback => db.transaction(callback));
    process.env.ENCRYPTION_KEY ||= 'a'.repeat(64);
    const { app } = require('../server/app');
    server = app.listen(0,'127.0.0.1');
    await new Promise(resolve => server.once('listening',resolve));
    const origin = 'http://127.0.0.1:' + server.address().port + '/api/v1';
    const jwtSecret = process.env.JWT_SECRET || 'dev_secret_change_in_production';
    const slug = 'icreate-testing-account';
    const call = (path,method='GET',body,account={slug,id:tenantId}) => fetch(origin+path,{
        method,body:body===undefined?undefined:JSON.stringify(body),headers:{'X-Tenant-Slug':account.slug,
            'Content-Type':'application/json',Authorization:'Bearer '+jwt.sign({id:userId,role:'tenant_admin',tenant_id:account.id},jwtSecret)}
    });
    const base = '/tenants/'+slug;
    const theme = base+'/theme';
    const site = base+'/site';
    const publicTenant = async () => (await call('/public/tenant')).json();
    assert.equal((await publicTenant()).site,null);
    assert.equal((await call('/tenants/retail/theme','POST',{theme_id:driving,apply_layout:true},{slug:'retail',id:retailId})).status,403);

    const restored = await call(theme,'POST',{restore_previous:true});
    assert.equal(restored.status,200);
    assert.equal((await restored.json()).tenant.theme_id,barber);
    assert.deepEqual((await publicTenant()).site,old);
    const before = await (await call(site)).json();
    assert.deepEqual(before.draft,draft);
    const applied = await call(theme,'POST',{theme_id:driving,apply_layout:true});
    assert.equal(applied.status,200);
    assert.equal((await applied.json()).theme_key,'driving-lessons');
    const active = await (await call(site)).json();
    assert.equal(active.draft,null);
    assert.equal(active.published,null);
    assert.equal(active.template_revision,before.template_revision+1);
    assert.equal((await publicTenant()).themeKey,'driving-lessons');
    assert.equal((await publicTenant()).site,null);
    assert.equal((await call(site+'/draft','PUT',{site:draft,template_revision:before.template_revision})).status,409);
    assert.equal((await call(site+'/publish','POST',{site:draft,template_revision:before.template_revision})).status,409);
    assert.equal((await call(site+'/draft','PUT',{site:{brand:{name:'New driving design'}},template_revision:active.template_revision})).status,200);
    assert.equal((await publicTenant()).site,null);
    assert.equal((await call(site+'/publish','POST',{template_revision:active.template_revision})).status,200);
    assert.equal((await publicTenant()).site.brand.name,'New driving design');

    assert.equal((await call(theme,'POST',{theme_id:driving,apply_layout:true})).status,200);
    assert.equal((await publicTenant()).site,null);
    assert.equal((await call(theme,'POST',{restore_previous:true})).status,200);
    assert.equal((await publicTenant()).site.brand.name,'New driving design');
});
