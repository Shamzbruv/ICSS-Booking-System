const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PGlite } = require('@electric-sql/pglite');
const jwt = require('jsonwebtoken');
const database = require('../server/db/connection');
const { migratePlatformAnnouncements } = require('../server/db/platformAnnouncements');

test('developer announcements are shared across tenants and dismissals belong to each dashboard user', async t => {
    const db = new PGlite();
    let server;
    t.after(async () => {
        if (server) await new Promise(resolve => server.close(resolve));
        await db.close();
    });
    await db.exec(`
        CREATE TABLE plans (id TEXT PRIMARY KEY, features JSONB, limits JSONB);
        CREATE TABLE tenants (id UUID PRIMARY KEY, slug TEXT UNIQUE, active BOOLEAN DEFAULT true, plan_id TEXT, features JSONB, limits JSONB);
        CREATE TABLE users (id UUID PRIMARY KEY, name TEXT);
        CREATE TABLE impersonation_sessions (id UUID PRIMARY KEY, mode TEXT, actor_user_id UUID,
            target_tenant_id UUID, revoked_at TIMESTAMPTZ, expires_at TIMESTAMPTZ);
        CREATE TABLE audit_log (tenant_id UUID, user_id UUID, action TEXT, entity TEXT, entity_id UUID, metadata JSONB, ip_address TEXT);
    `);
    const schema = { query: sql => db.exec(sql) };
    await migratePlatformAnnouncements(schema);
    await migratePlatformAnnouncements(schema);

    const [first, second, developer, owner, staff, otherTenant] = Array.from({ length:6 }, randomUUID);
    await db.query("INSERT INTO tenants(id,slug) VALUES ($1,'first'),($2,'second')", [first,second]);
    await db.query("INSERT INTO users VALUES ($1,'Developer'),($2,'First owner'),($3,'Staff'),($4,'Second owner')", [developer,owner,staff,otherTenant]);

    t.mock.method(database, 'query', (sql, params) => db.query(sql, params));
    process.env.ENCRYPTION_KEY ||= 'a'.repeat(64);
    const { app } = require('../server/app');
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port + '/api/v1';
    const secret = process.env.JWT_SECRET || 'dev_secret_change_in_production';
    const dev = { id:developer, role:'developer_admin' };
    const tenant = { id:owner, role:'tenant_admin', tenant_id:first };
    const staffUser = { id:staff, role:'staff', tenant_id:first };
    const other = { id:otherTenant, role:'tenant_admin', tenant_id:second };
    const sessionId = randomUUID();
    await db.query(`INSERT INTO impersonation_sessions (id,mode,actor_user_id,target_tenant_id,expires_at)
        VALUES ($1,'read_only',$2,$3,NOW() + INTERVAL '1 hour')`, [sessionId,developer,first]);
    const preview = { ...tenant, actor_user_id:developer, impersonation_session_id:sessionId };
    const request = (path, user, slug, method='GET', body) => fetch(origin + path, {
        method, body: body && JSON.stringify(body),
        headers: { 'Content-Type':'application/json', ...(user && { Authorization:'Bearer ' + jwt.sign(user,secret) }), ...(slug && { 'X-Tenant-Slug':slug }) }
    });

    const platform = '/platform/announcements';
    const dashboard = '/announcements';
    const draft = { requestId:randomUUID(), title:'New calendar tools', body:'First line.\nSecond line.' };
    assert.equal((await request(platform,tenant,'first','POST',draft)).status,403);
    assert.equal((await request(platform,null)).status,401);
    assert.equal((await request(platform,dev,null,'POST',{ ...draft,body:'  ' })).status,400);
    const published = await request(platform,dev,null,'POST',draft);
    assert.equal(published.status,201);
    assert.equal((await published.json()).id,draft.requestId);
    assert.equal((await request(platform,dev,null,'POST',draft)).status,200);
    assert.equal((await request(platform,dev,null,'POST',{ ...draft,title:'Different announcement' })).status,409);
    const history = await (await request(platform,dev)).json();
    assert.equal(history.announcements.length,1);
    assert.equal(history.announcements[0].author_name,'Developer');

    const unread = async (user,slug) => (await (await request(dashboard,user,slug)).json()).announcement;
    assert.equal((await unread(tenant,'first')).body,draft.body);
    assert.equal((await unread(other,'second')).id,draft.requestId);
    const dismiss = dashboard + '/' + draft.requestId + '/dismiss';
    assert.equal((await request(dismiss,tenant,'second','POST')).status,403);
    assert.equal((await request(dismiss,tenant,'first','POST')).status,200);
    assert.equal((await request(dismiss,tenant,'first','POST')).status,200);
    assert.equal(await unread(tenant,'first'),null);
    const inbox = await (await request(dashboard,tenant,'first')).json();
    assert.equal(inbox.unread,0);
    assert.ok(inbox.announcements[0].dismissed_at);
    const previewInbox = await (await request(dashboard,preview,'first')).json();
    assert.equal(previewInbox.unread,1);
    assert.equal(previewInbox.announcement.id,draft.requestId);
    assert.equal(previewInbox.announcements[0].dismissed_at,null);
    assert.equal((await request('/notifications',preview,'first')).status,403);
    assert.equal((await request(dismiss,preview,'first','POST')).status,403);
    await db.query("UPDATE impersonation_sessions SET mode='edit' WHERE id=$1", [sessionId]);
    assert.equal((await request(dashboard + '/dismiss-all',preview,'first','POST')).status,403);
    assert.equal((await unread(staffUser,'first')).id,draft.requestId);
    assert.equal((await unread(other,'second')).id,draft.requestId);

    assert.equal((await request(dashboard + '/dismiss-all',staffUser,'first','POST')).status,200);
    assert.equal(await unread(staffUser,'first'),null);
    assert.equal((await unread(other,'second')).id,draft.requestId);
    assert.equal((await request(platform + '/' + draft.requestId + '/withdraw',dev,null,'POST')).status,200);
    assert.equal(await unread(other,'second'),null);
    assert.deepEqual((await db.query('SELECT action FROM audit_log ORDER BY action')).rows.map(row => row.action),
        ['announcement.published','announcement.withdrawn']);
});
