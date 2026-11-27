const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
const { query } = require('../db/connection');
const { MEDIA_RULES } = require('../services/media');
const {
    CARD_HEIGHT, CARD_WIDTH, brandAssets, buildSiteMetadata, cardBackground, isTenantSlug,
    renderContent, renderHead, renderTenantLinks, renderTenantSitemap
} = require('../services/tenantSeo');

async function findPublicTenant(slug) {
    if (!isTenantSlug(slug)) return null;
    const { rows } = await query(
        `SELECT id, name, slug, branding, site_config, is_test_account,
                EXISTS (SELECT 1 FROM services WHERE tenant_id = tenants.id AND active = true) AS has_services
         FROM tenants WHERE slug = $1 AND active = true`, [slug]);
    return rows[0] || null;
}

async function resolveAssets(tenant) {
    const assets = brandAssets(tenant);
    const ids = Object.values(assets).filter(asset => asset?.mediaId).map(asset => asset.mediaId);
    if (!ids.length) return assets;

    const { rows } = await query(
        `SELECT id FROM tenant_media WHERE tenant_id = $1 AND kind = 'image' AND id = ANY($2::uuid[])`,
        [tenant.id, ids]);
    const available = new Set(rows.map(row => row.id));
    return Object.fromEntries(Object.entries(assets).map(([key, asset]) => [key, asset?.mediaId && !available.has(asset.mediaId) ? null : asset]));
}

function notFound(res) {
    return res.status(404).set('X-Robots-Tag', 'noindex').type('html').send('<!doctype html><html lang="en"><title>Page not found</title><h1>Page not found</h1><p>This booking link may have changed.</p><a href="/">ICSS Bookings</a></html>');
}

function createTenantSiteHandlers(frontendDir, publicDir) {
    const indexFile = path.join(frontendDir, 'index.html');
    let htmlPromise;
    const readShell = () => {
        if (!htmlPromise) htmlPromise = fs.readFile(indexFile, 'utf8').catch(error => { htmlPromise = null; throw error; });
        return htmlPromise;
    };

    async function drivingLessonsPreview(_req, res) {
        const image = 'https://icssbookings.com/images/starter-kits/driving-ja-hero.webp';
        const title = 'Driving Lessons JA | Website Preview';
        const description = 'Explore driving lesson packages in Kingston and Portmore and try the booking experience.';
        const head = `<title>${title}</title>
<meta name="robots" content="noindex, nofollow">
<meta name="description" content="${description}">
<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:image" content="${image}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/webp" href="/images/starter-kits/driving-ja-logo.webp">`;
        const html = (await readShell()).replace(/<!-- SITE_HEAD_START -->[\s\S]*?<!-- SITE_HEAD_END -->/, () => head);
        return res.set({ 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' }).type('html').send(html);
    }

    async function tenantPage(req, res) {
        const slug = req.params[0];
        const page = req.params[1] || 'home';
        const tenant = await findPublicTenant(slug);
        if (!tenant) return notFound(res);

        if (req.query.preview === '1') {
            return res.set({'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'no-store'}).sendFile(indexFile);
        }
        if (req.path.endsWith('/') || req.params[1] === 'home') {
            const queryString = req.originalUrl.slice(req.path.length);
            return res.redirect(308, (page === 'home' ? '/' + slug : '/' + slug + '/' + page) + queryString);
        }

        const [{ rows: services }, assets, shell] = await Promise.all([
            query('SELECT name, description FROM services WHERE tenant_id = $1 AND active = true ORDER BY name LIMIT 30', [tenant.id]),
            resolveAssets(tenant),
            readShell()
        ]);
        const metadata = buildSiteMetadata(tenant, services, assets);
        const pageData = metadata.pages[page];
        const head = renderHead(metadata, page, slug);
        const initialContent = renderContent(metadata, page);
        const html = shell
            .replace(/<!-- SITE_HEAD_START -->[\s\S]*?<!-- SITE_HEAD_END -->/, () => head)
            .replace('<div id="root"></div>', () => `<div id="root">${initialContent}</div>`);
        if (pageData.robots.startsWith('noindex')) res.set('X-Robots-Tag', pageData.robots);
        return res.set('Cache-Control', 'no-cache').type('html').send(html);
    }

    async function shareCard(req, res) {
        const tenant = await findPublicTenant(req.params[0]);
        if (!tenant) return notFound(res);
        const { logo, share } = await resolveAssets(tenant);
        const logoOnly = req.params[1] === 'site-logo.png';
        const asset = logoOnly ? logo : share || logo;
        if (!asset?.mediaId && !asset?.data) return notFound(res);
        let data = asset.data;
        if (asset.mediaId) {
            const { rows } = await query(
                `SELECT data FROM tenant_media WHERE id = $1 AND tenant_id = $2 AND kind = 'image' AND size_bytes <= $3`,
                [asset.mediaId, tenant.id, MEDIA_RULES.image.maxBytes]);
            data = rows[0]?.data;
        }
        if (!data) return notFound(res);

        let card;
        try {
            const source = sharp(data, { limitInputPixels: 25000000 }).autoOrient();
            if (logoOnly) {
                card = await source.resize(192, 192, { fit: 'contain', background: '#ffffff00' }).png().toBuffer();
            } else if (share) {
                card = await source.resize(CARD_WIDTH, CARD_HEIGHT, { fit: 'cover' }).flatten({ background: '#ffffff' }).png().toBuffer();
            } else {
                const logoImage = await source.resize(590, 420, { fit: 'inside' }).png().toBuffer();
                card = await sharp({ create: { width: CARD_WIDTH, height: CARD_HEIGHT, channels: 3, background: cardBackground(tenant.site_config) } })
                    .composite([{ input: logoImage, gravity: 'centre' }]).png().toBuffer();
            }
        } catch {
            // Retain the owned public image if the source cannot be resized.
            return asset.url ? res.set('X-Robots-Tag', 'noindex').redirect(302, asset.url) : notFound(res);
        }
        return res.set({
            'Cache-Control': 'public, max-age=3600',
            'Cross-Origin-Resource-Policy': 'cross-origin'
        }).type('png').send(card);
    }

    async function homepage(req, res, next) {
        try {
            const [html, { rows }] = await Promise.all([
                fs.readFile(path.join(publicDir, 'index.html'), 'utf8'),
                query(`SELECT slug, name, is_test_account,
                             CASE WHEN site_config IS NULL THEN NULL ELSE jsonb_build_object(
                                 'brand', jsonb_build_object('name', site_config->'brand'->'name'),
                                 'seo', jsonb_build_object('noIndex', site_config->'seo'->'noIndex')
                             ) END AS site_config,
                             EXISTS (SELECT 1 FROM services WHERE tenant_id = tenants.id AND active = true) AS has_services
                       FROM tenants WHERE active = true AND is_test_account IS DISTINCT FROM true`)
            ]);
            const links = renderTenantLinks(rows);
            return res.set('Cache-Control', 'no-cache').type('html')
                .send(html.replace('<!-- PUBLIC_TENANT_LINKS -->', () => links));
        } catch (error) {
            console.error('[Homepage tenant links]', error.message);
            return next();
        }
    }

    async function sitemap(req, res) {
        const [marketing, { rows }] = await Promise.all([
            fs.readFile(path.join(publicDir, 'sitemap.xml'), 'utf8'),
            query(`SELECT slug, is_test_account,
                         CASE WHEN site_config IS NULL THEN NULL ELSE jsonb_build_object(
                             'seo', jsonb_build_object('noIndex', site_config->'seo'->'noIndex'),
                             'enabled', site_config->'enabled', 'layoutMode', site_config->'layoutMode',
                             'pages', (SELECT jsonb_agg(jsonb_build_object('id', page->'id', 'visible', page->'visible'))
                                 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(site_config->'pages') = 'array' THEN site_config->'pages' ELSE '[]'::jsonb END) page)
                         ) END AS site_config,
                         EXISTS (SELECT 1 FROM services WHERE tenant_id = tenants.id AND active = true) AS has_services
                   FROM tenants WHERE active = true AND is_test_account IS DISTINCT FROM true ORDER BY slug`)
        ]);
        const entries = renderTenantSitemap(rows);
        const xml = marketing.replace('</urlset>', () => `${entries ? entries + '\n' : ''}</urlset>`);
        res.set('Cache-Control', 'public, max-age=300').type('application/xml').send(xml);
    }

    return { homepage, tenantPage, shareCard, sitemap, drivingLessonsPreview };
}

module.exports = { createTenantSiteHandlers };
