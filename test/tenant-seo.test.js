const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');
const sharp = require('sharp');
const { PGlite } = require('@electric-sql/pglite');
const database = require('../server/db/connection');

test('tenant search pages, branded previews and sitemap reflect public content only', async (t) => {
    const db = new PGlite();
    t.after(() => db.close());
    t.mock.method(database, 'query', (sql, params) => db.query(sql, params));
    const { createTenantSiteHandlers } = require('../server/routes/tenantSites');
    await db.exec(`
        CREATE TABLE tenants (id int PRIMARY KEY, slug text, name text, branding jsonb, site_config jsonb, site_draft jsonb, active boolean DEFAULT true, is_test_account boolean DEFAULT false);
        CREATE TABLE services (tenant_id int, name text, description text, active boolean);
        CREATE TABLE tenant_media (tenant_id int, id uuid, kind text, size_bytes int, data bytea);
        INSERT INTO tenants (id, slug, name, branding, site_config, site_draft) VALUES
            (1, 'glam-by-tia', 'Tenant record', '{}',
                '{"brand":{"name":"Glam & Tia","logoUrl":"/media/902a54c6-740f-4fa1-830a-c74a9b196a77"},"contact":{"address":"Kingston, Jamaica"},"seo":{"title":"Glam & Tia | Makeup Artist"},"pages":[{"id":"home","sections":[{"type":"hero","props":{"headline":"Makeup for your big day","subheadline":"Bridal and editorial makeup."}},{"type":"intro","visible":false,"props":{"body":"This section is hidden"}}]},{"id":"about","visible":true},{"id":"gallery","visible":false}]}',
                '{"brand":{"name":"Unpublished draft name"}}'),
            (2, 'private-studio', 'Private Studio', '{}', '{"seo":{"noIndex":true}}', null),
            (3, 'legacy-studio', 'Legacy Makeup', '{}', null, null),
            (4, 'empty-studio', 'Empty Studio', '{}', null, null),
            (5, 'closed-studio', 'Closed Studio', '{}', '{}', null),
            (6, 'one-page-studio', 'One Page Studio', '{}', '{"layoutMode":"onepage"}', null),
            (7, 'test-studio', 'Test Studio', '{}', '{}', null);
        UPDATE tenants SET active = false WHERE id = 5;
        UPDATE tenants SET is_test_account = true WHERE id = 7;
        INSERT INTO services VALUES (1, 'Bridal Makeup', 'Soft glam for a wedding.', true), (1,'Staff-only service','Internal',false),
            (3, 'Makeup Consultation', 'Consultation.', true);
    `);
    const mark = await sharp({ create: { width: 28, height: 20, channels: 3, background: '#993355' } }).png().toBuffer();
    await db.query("INSERT INTO tenant_media VALUES (1, '902a54c6-740f-4fa1-830a-c74a9b196a77', 'image', $1, $2)", [mark.length, mark]);
    await db.query('UPDATE tenants SET branding=$1 WHERE id=3', [JSON.stringify({ logoUrl: 'data:image/png;base64,' + mark.toString('base64') })]);

    const handlers = createTenantSiteHandlers(path.join(__dirname, '../frontend'), path.join(__dirname, '../public'));
    const app = express();
    app.get('/', handlers.homepage);
    app.get('/sitemap.xml', handlers.sitemap);
    app.get(/^\/([a-z0-9-]{2,50})\/(share-card\.png|site-logo\.png)$/, handlers.shareCard);
    app.get(/^\/([a-z0-9-]{2,50})(?:\/(home|about|gallery|book))?\/?$/, handlers.tenantPage);
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    t.after(() => new Promise(resolve => server.close(resolve)));
    const origin = 'http://127.0.0.1:' + server.address().port;
    const get = (url, options) => fetch(origin + url, options);

    const homepage = await get('/');
    assert.equal(homepage.status, 200);
    const homepageHtml = await homepage.text();
    assert.match(homepageHtml, /href="https:\/\/icssbookings\.com\/glam-by-tia">Glam &amp; Tia<\/a>/);
    assert.match(homepageHtml, /href="https:\/\/icssbookings\.com\/legacy-studio">Legacy Makeup<\/a>/);
    assert.doesNotMatch(homepageHtml, /private-studio|closed-studio|test-studio|empty-studio|Unpublished draft name/);

    const home = await get('/glam-by-tia');
    assert.equal(home.status, 200);
    const html = await home.text();
    assert.match(html, /<title>Glam &amp; Tia \| Makeup Artist<\/title>/);
    assert.match(html, /<h1>Glam &amp; Tia<\/h1>/);
    assert.match(html, /<li><strong>Bridal Makeup<\/strong>/);
    assert.match(html, /Makeup for your big day/);
    assert.match(html, /<meta property="og:site_name" content="Glam &amp; Tia">/);
    assert.doesNotMatch(html, /Unpublished draft name|This section is hidden|Staff-only service|icssbookings\.com\/og-image\.png/);
    const graph = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1])['@graph'];
    assert.equal(graph[0].name, 'Glam & Tia');
    assert.equal(graph[0].logo, 'https://icssbookings.com/media/902a54c6-740f-4fa1-830a-c74a9b196a77');
    assert.equal(graph[0].hasOfferCatalog.itemListElement[0].itemOffered.name, 'Bridal Makeup');

    const book = await get('/glam-by-tia/book?service=example');
    const bookHtml = await book.text();
    assert.match(bookHtml, /<title>Book with Glam &amp; Tia<\/title>/);
    assert.match(bookHtml, /rel="canonical" href="https:\/\/icssbookings.com\/glam-by-tia\/book"/);
    const cardUrl = new URL(bookHtml.match(/property="og:image" content="([^"]+)"/)[1]);
    const card = await get(cardUrl.pathname + cardUrl.search);
    assert.equal(card.status, 200);
    assert.equal(card.headers.get('content-type'), 'image/png');
    const dimensions = await sharp(Buffer.from(await card.arrayBuffer())).metadata();
    assert.deepEqual([dimensions.width, dimensions.height], [1200, 630]);

    await db.query(`UPDATE tenants SET site_config = jsonb_set(site_config, '{seo,shareImageUrl}', to_jsonb($1::text)) WHERE id = 1`,
        ['https://images.example.com/preview.png']);
    const customCardHtml = await (await get('/glam-by-tia/book')).text();
    assert.match(customCardHtml, /property="og:image" content="https:\/\/images\.example\.com\/preview\.png"/);
    assert.match(customCardHtml, /rel="icon" href="https:\/\/icssbookings\.com\/media\//);
    await db.query(`UPDATE tenants SET site_config = $1 WHERE id = 2`, [
        JSON.stringify({ brand: { logoUrl: '/media/902a54c6-740f-4fa1-830a-c74a9b196a77' }, seo: { noIndex: true } })
    ]);
    const otherBusiness = await (await get('/private-studio')).text();
    assert.doesNotMatch(otherBusiness, /property="og:image"|902a54c6-740f/);
    assert.equal((await get('/private-studio/share-card.png')).status, 404);

    const legacy = await get('/legacy-studio/book');
    const legacyHtml = await legacy.text();
    assert.match(legacyHtml, /site-logo\.png\?v=[a-f0-9]+/);
    assert.doesNotMatch(legacyHtml, /data:image\/png/);
    assert.equal((await get('/legacy-studio/site-logo.png')).status, 200);
    assert.equal((await get('/legacy-studio/share-card.png')).status, 200);
    for (const url of ['/glam-by-tia/gallery', '/private-studio', '/empty-studio', '/test-studio', '/glam-by-tia?preview=1']) {
        assert.match((await get(url)).headers.get('x-robots-tag'), /noindex/, url);
    }
    for (const url of ['/closed-studio', '/unknown-studio']) assert.equal((await get(url)).status, 404);
    assert.equal((await get('/glam-by-tia/book/?service=example', { redirect: 'manual' })).headers.get('location'), '/glam-by-tia/book?service=example');
    const sitemap = await (await get('/sitemap.xml')).text();
    for (const url of ['/industries/salons', '/glam-by-tia', '/glam-by-tia/about', '/glam-by-tia/book', '/legacy-studio', '/one-page-studio']) {
        assert.ok(sitemap.includes('https://icssbookings.com' + url + '</loc>'), url);
    }
    assert.doesNotMatch(sitemap, /private-studio|empty-studio|closed-studio|test-studio|one-page-studio\/book|glam-by-tia\/gallery/);
});
