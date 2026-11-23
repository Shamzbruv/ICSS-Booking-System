const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const { Resend } = require('resend');
const { PGlite } = require('@electric-sql/pglite');
const database = require('../server/db/connection');
const { migrateNewsletter } = require('../server/db/newsletterSchema');

test('newsletter confirmation, design, individual and broadcast sends, and unsubscribe are tenant-scoped', async t => {
    const db = new PGlite();
    await db.exec(`
        CREATE TABLE plans (id TEXT PRIMARY KEY, features JSONB DEFAULT '{}', limits JSONB DEFAULT '{}');
        CREATE TABLE tenants (id UUID PRIMARY KEY, slug TEXT UNIQUE, name TEXT, active BOOLEAN DEFAULT true,
            plan_id TEXT, branding JSONB, site_config JSONB, features JSONB, limits JSONB);
        CREATE TABLE users (id UUID DEFAULT gen_random_uuid(), tenant_id UUID, email TEXT, role TEXT,
            active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW());
    `);
    const schema = { query: sql => db.exec(sql) };
    await migrateNewsletter(schema);
    await migrateNewsletter(schema);
    const first = randomUUID();
    const second = randomUUID();
    await db.query(`
        INSERT INTO tenants(id,slug,name,branding,site_config) VALUES
        ($1,'glam','Glam Studio','{}','{"brand":{"name":"Glam & Co","logoUrl":"https://example.com/logo.png"},"style":{"colors":{"primary":"#123abc"}}}'),
        ($2,'studio','Other Studio','{}',NULL)`, [first,second]);
    await db.query(`INSERT INTO users(tenant_id,email,role) VALUES
        ($1,'owner@glam.example','tenant_admin'),($2,'other-owner@studio.example','tenant_admin')`, [first,second]);
    const delivered = [];
    const bookingEmails = [];
    t.mock.method(Resend.prototype,'post',async (_path,payload) => {
        bookingEmails.push(payload);
        return { data:{ id:'booking-email' }, error:null };
    });
    t.mock.method(database, 'query', (sql, params) => db.query(sql, params));
    t.mock.method(database, 'transaction', fn => db.transaction(fn));
    const emailService = require('../server/services/email');
    t.mock.method(emailService, 'sendNewsletterEmail', async payload => {
        delivered.push(payload);
        return { id: 'mail-' + delivered.length };
    });
    const testEnv = { RESEND_API_KEY:'test-key', ENCRYPTION_KEY:'a'.repeat(64) };
    const previous = Object.fromEntries(Object.keys(testEnv).map(key => [key,process.env[key]]));
    Object.assign(process.env,testEnv);
    t.after(() => {
        for (const [key,value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    });
    const { processDelivery } = require('../server/services/newsletter');
    const { app } = require('../server/app');
    const server = app.listen(0,'127.0.0.1');
    await new Promise(resolve => server.once('listening',resolve));
    t.after(async () => {
        await new Promise(resolve => server.close(resolve));
        await db.close();
    });
    const base = 'http://127.0.0.1:' + server.address().port + '/api/v1/newsletter/';
    const secret = process.env.JWT_SECRET || 'dev_secret_change_in_production';
    const token = (tenant, role='tenant_admin') => jwt.sign({ id:randomUUID(), tenant_id:tenant, role },secret);
    const admin = (path, method='GET', body, tenant=first, slug='glam', role) => fetch(base + path,{
        method, body:body && JSON.stringify(body),
        headers:{ Authorization:'Bearer ' + token(tenant,role), 'X-Tenant-Slug':slug, 'Content-Type':'application/json' }
    });
    const post = (path, body) => fetch(base + path,{
        method:'POST', body:body && JSON.stringify(body), headers:{ 'Content-Type':'application/json' }
    });
    const signup = (email, slug='glam', consent=true) => post('subscribe',{ email,slug,consent });

    const replySettingsUrl = 'http://127.0.0.1:' + server.address().port + '/api/v1/tenants/glam/email-replies';
    const replies = (tenant=first,method='GET',email) => fetch(replySettingsUrl,{
        method, body:email === undefined ? undefined : JSON.stringify({email}),
        headers:{ Authorization:'Bearer '+token(tenant), 'X-Tenant-Slug':'glam', 'Content-Type':'application/json' }
    });
    assert.equal((await replies(second)).status,403);
    assert.deepEqual(await (await replies()).json(),{configured:'',effective:'owner@glam.example'});
    assert.equal((await replies(first,'PATCH','bad address')).status,400);
    assert.deepEqual(await (await replies(first,'PATCH','hello@glam.example')).json(),{
        configured:'hello@glam.example',effective:'hello@glam.example'
    });
    await emailService.sendBookingCancellationEmail({
        email:'client@example.com',name:'Client',booking_date:'2026-11-23',booking_time:'12:30'
    },null,{id:first,name:'Glam'});
    assert.equal(bookingEmails[0].reply_to,'hello@glam.example');
    assert.equal(bookingEmails[0].cc,undefined);
    assert.equal((await admin('subscribers','GET',null,second,'glam')).status,403);
    assert.equal((await admin('subscribers','GET',null,first,'glam','staff')).status,403);
    assert.equal((await signup('alice@example.com')).status,404);
    const { brand, enabled } = await (await admin('settings')).json();
    assert.equal(brand.name,'Glam & Co');
    assert.equal(brand.accent,'#123abc');
    assert.equal(enabled,false);
    const design = { layout:'bold', accent:'#004455', background:'#efeaff', showLogo:true, footer:'See you soon' };
    assert.equal((await admin('settings','PUT',{enabled:true,design})).status,200);
    assert.deepEqual((await (await admin('settings')).json()).design,design);
    assert.equal((await admin('settings','PUT',{enabled:true,design},second,'studio')).status,200);
    assert.equal((await signup('alice@example.com','glam',false)).status,400);

    async function join(email,slug='glam') {
        assert.equal((await signup(email,slug)).status,202);
        const link = delivered.at(-1).html.match(/https:\/\/icssbookings\.com\/api\/v1\/newsletter\/(confirm\/[a-f\d-]+)/)[1];
        assert.equal((await fetch(base + link)).status,200);
        assert.equal((await post(link)).status,200);
        return link;
    }
    const oldLink = await join('ALICE@EXAMPLE.COM');
    assert.equal(delivered.at(-1).brand.replyTo,'hello@glam.example');
    await join('bob@example.com');
    await join('alice@example.com','studio');
    assert.equal((await signup('pending@example.com')).status,202);
    const count = delivered.length;
    assert.equal((await signup('alice@example.com')).status,202);
    assert.equal(delivered.length,count);
    const subscribers = await (await admin('subscribers')).json();
    assert.equal(subscribers.totals.subscribed,2);
    assert.equal(subscribers.totals.pending,1);
    const find = (address, rows=subscribers.subscribers) => rows.find(row => row.email===address);
    const other = await (await admin('subscribers','GET',null,second,'studio')).json();
    const message = { subject:'Update', heading:'<New>', body:'Hello <script>alert(1)</script>\n\nNext paragraph', actionLabel:'Book', actionUrl:'https://example.com/book' };
    const preview = await (await admin('preview','POST',{design,message})).json();
    assert.match(preview.html,/Glam &amp; Co/);
    assert.match(preview.html,/#004455/);
    assert.match(preview.html,/&lt;script&gt;/);
    assert.doesNotMatch(preview.html,/<script>/);
    assert.equal((await admin('preview','POST',{design,message:{...message,actionUrl:'javascript:alert(1)'}})).status,400);

    const send = (audience, subscriberId, requestId=randomUUID()) => admin('campaigns','POST',{audience,subscriberId,requestId,design,message});
    assert.equal((await send('individual',other.subscribers[0].id)).status,409);
    assert.equal((await send('individual',find('pending@example.com').id)).status,409);
    const individualId = randomUUID();
    const individualResponse = await send('individual',find('alice@example.com').id,individualId);
    assert.equal(individualResponse.status,202);
    const individual = await individualResponse.json();
    assert.equal(individual.recipients,1);
    assert.equal((await (await send('individual',find('alice@example.com').id,individualId)).json()).id,individual.id);
    await processDelivery(database.query,emailService.sendNewsletterEmail);
    const single = delivered.at(-1);
    assert.equal(single.email,'alice@example.com');
    assert.equal(single.brand.replyTo,'hello@glam.example');
    assert.equal(single.headers['List-Unsubscribe-Post'],'List-Unsubscribe=One-Click');
    const unsubscribe = single.headers['List-Unsubscribe'].match(/(unsubscribe\/[a-f\d-]+)/)[1];
    assert.match(single.html,/Unsubscribe/);

    const batch = await (await send('all')).json();
    assert.equal(batch.recipients,2);
    assert.equal((await fetch(base + unsubscribe)).status,200);
    assert.equal((await (await admin('subscribers')).json()).totals.subscribed,2);
    assert.equal((await fetch(base + unsubscribe,{method:'POST',body:new URLSearchParams({'List-Unsubscribe':'One-Click'})})).status,200);
    assert.equal((await post(oldLink)).status,410);
    await Promise.all([processDelivery(database.query,emailService.sendNewsletterEmail), processDelivery(database.query,emailService.sendNewsletterEmail)]);
    assert.equal(await processDelivery(database.query,emailService.sendNewsletterEmail),false);
    assert.equal(delivered.at(-1).email,'bob@example.com');
    assert.equal(delivered.length,count+2);
    const { campaigns } = await (await admin('campaigns')).json();
    const report = campaigns.find(row=>row.id===batch.id);
    assert.deepEqual([report.sent,report.skipped,report.failed],[1,1,0]);
    assert.equal((await (await admin('subscribers','GET',null,second,'studio')).json()).totals.subscribed,1);

    await join('alice@example.com');
    const retry = await (await send('individual',find('bob@example.com').id)).json();
    await processDelivery(database.query,async () => { throw new Error('temporary delivery failure'); });
    await db.query('UPDATE newsletter_deliveries SET ready_at=NOW() WHERE campaign_id=$1',[retry.id]);
    await processDelivery(database.query,emailService.sendNewsletterEmail);
    const { rows:[retried] } = await db.query('SELECT status,attempts FROM newsletter_deliveries WHERE campaign_id=$1',[retry.id]);
    assert.deepEqual(retried,{status:'sent',attempts:2});
});
