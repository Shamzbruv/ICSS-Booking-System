const { createHash } = require('node:crypto');
const { looksLikeDeclaredType, MEDIA_RULES } = require('./media');

const ORIGIN = 'https://icssbookings.com';
const SLUG = /^[a-z0-9-]{2,50}$/;
const APP_ROUTES = ['onboarding', 'themes', 'provisioning', 'editor', 'custom-theme', 'platform', 'forgot-password', 'reset-password', 'demo', 'manage', 'consultation'];
const UNAVAILABLE_SLUGS = new Set([...APP_ROUTES, 'admin', 'api', 'media', 'health', 'industries', 'faq', 'terms', 'whatsapp-terms', 'playground', 'template', 'images', 'assets']);
const PAGE_LABELS = { home: 'Home', about: 'About', gallery: 'Gallery', book: 'Book online' };
const MEDIA_PATH = /^\/media\/([\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12})$/i;
const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;

function isTenantSlug(slug) {
    return SLUG.test(slug) && !UNAVAILABLE_SLUGS.has(slug);
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function safeJson(value) {
    return JSON.stringify(value).replace(/[<>&]/g, character => '\\u' + character.charCodeAt(0).toString(16).padStart(4, '0'));
}

function plainText(value, limit = 200) {
    if (typeof value !== 'string') return '';
    const text = value.replace(/<[^>]*>/g, '').replace(/[\x00-\x1f\x7f]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (text.length <= limit) return text;
    const shortened = text.slice(0, limit - 1);
    const lastSpace = shortened.lastIndexOf(' ');
    return (lastSpace > limit * 0.7 ? shortened.slice(0, lastSpace) : shortened) + '…';
}

function websiteUrl(value) {
    if (typeof value !== 'string' || value.length > 6000) return '';
    if (MEDIA_PATH.test(value)) return ORIGIN + value;
    try {
        const url = new URL(value);
        if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
    } catch {
        return '';
    }
    return '';
}

function imageReference(value) {
    if (typeof value === 'string' && value.startsWith('data:image/') && value.length < 4 * MEDIA_RULES.image.maxBytes / 3 + 50) {
        const match = /^data:(image\/(?:png|jpeg|gif|webp|avif));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
        if (!match) return null;
        const data = Buffer.from(match[2], 'base64');
        if (data.length <= MEDIA_RULES.image.maxBytes && looksLikeDeclaredType(data, match[1])) return { data };
        return null;
    }
    const url = websiteUrl(value);
    if (!url) return null;
    const parsed = new URL(url);
    const isPlatformMedia = ['icssbookings.com', 'www.icssbookings.com'].includes(parsed.hostname) && parsed.pathname.startsWith('/media/');
    if (isPlatformMedia) {
        const id = MEDIA_PATH.exec(parsed.pathname)?.[1].toLowerCase();
        return id ? { url: ORIGIN + '/media/' + id, mediaId: id } : null;
    }
    // Direct external URLs are passed to link-preview crawlers. The app never fetches them.
    return { url };
}

function brandAssets(tenant) {
    const site = tenant.site_config || {};
    const logo = site.brand?.logoUrl ?? tenant.branding?.logoUrl;
    const useLegacyLogo = !logo && !Object.hasOwn(site, 'booking');
    return {
        logo: imageReference(useLegacyLogo ? tenant.branding?.logoUrl : logo),
        share: imageReference(site.seo?.shareImageUrl)
    };
}

function isIndexable(tenant) {
    return isTenantSlug(tenant.slug) && !tenant.is_test_account && tenant.site_config?.seo?.noIndex !== true &&
        (Boolean(tenant.site_config) || tenant.has_services === true);
}

function pageList(site = {}) {
    if (site.enabled === false || site.layoutMode === 'onepage') return ['home'];
    // Unpublished legacy sites always expose a booking page. Only list secondary
    // pages once the tenant has explicitly published them in the Website Builder.
    const savedPages = Array.isArray(site.pages) ? site.pages : [];
    return ['home', ...['about', 'gallery'].filter(id => savedPages.some(page => page?.id === id && page.visible !== false)), 'book'];
}

function pageUrl(slug, page) {
    return ORIGIN + '/' + slug + (page === 'home' ? '' : '/' + page);
}

function cardBackground(site) {
    const color = site?.style?.colors?.background;
    return /^#[0-9a-f]{6}$/i.test(color || '') ? color : '#ffffff';
}

function imageUrl(slug, asset, filename, background = '') {
    const revision = createHash('sha256').update(`v1:${filename}:${background}:`).update(asset.mediaId || asset.data).digest('hex').slice(0, 12);
    return `${pageUrl(slug, 'home')}/${filename}?v=${revision}`;
}

function pageContent(site, page) {
    const pages = Array.isArray(site.pages) ? site.pages : [];
    const sections = pages.find(entry => entry?.id === page)?.sections;
    if (!Array.isArray(sections)) return { heading: '', excerpts: [] };
    const visible = sections.filter(entry => entry?.visible !== false && ['hero', 'pageHeader', 'intro', 'services'].includes(entry?.type));
    const first = visible.find(entry => ['hero', 'pageHeader'].includes(entry.type))?.props;
    const excerpts = [...new Set(visible.flatMap(entry => [entry.props?.subheadline, entry.props?.subtitle, entry.props?.body])
        .map(value => plainText(value, 240)).filter(Boolean))].slice(0, 3);
    return { heading: plainText(first?.headline || first?.title, 110), excerpts };
}

function buildSiteMetadata(tenant, services, resolvedAssets) {
    const site = tenant.site_config || {};
    const name = plainText(site.brand?.name, 100) || plainText(tenant.name, 100) || tenant.slug;
    const location = plainText(site.contact?.address ?? tenant.branding?.location, 150);
    const tagline = plainText(site.brand?.tagline ?? tenant.branding?.bookingTagline, 140);
    const serviceList = services.map(service => ({ name: plainText(service.name, 110), description: plainText(service.description, 220) })).filter(service => service.name);
    const serviceNames = serviceList.slice(0, 3).map(service => service.name).join(', ');
    const description = plainText(site.seo?.description, 165) || plainText([
        tagline || (serviceNames ? `${name} offers ${serviceNames}.` : `Visit ${name} for services and appointments.`),
        location ? `Location: ${location}.` : ''
    ].filter(Boolean).join(' '), 165);
    const { logo, share } = resolvedAssets;
    const chosen = share || logo;
    const formattedImage = Boolean(chosen?.mediaId || chosen?.data);
    const image = formattedImage ? imageUrl(tenant.slug, chosen, 'share-card.png', share ? 'photo' : cardBackground(site)) : chosen?.url;
    const logoUrl = logo?.data ? imageUrl(tenant.slug, logo, 'site-logo.png') : logo?.url;
    const brand = { name, logo: logoUrl, image, formattedImage, location };
    const indexable = isIndexable(tenant);
    const publishedPages = pageList(site);
    const pages = {};
    for (const [page, label] of Object.entries(PAGE_LABELS)) {
        const content = pageContent(site, page);
        const available = publishedPages.includes(page);
        const title = page === 'home'
            ? plainText(site.seo?.title, 110) || plainText(tagline ? `${name} | ${tagline}` : name, 110)
            : plainText(page === 'book' ? `Book with ${name}` : `${label} | ${name}`, 110);
        const pageDescription = page === 'home' ? description : plainText(
            page === 'book' ? `Book online with ${name}.${serviceNames ? ' Services include ' + serviceNames + '.' : ' View services and available appointments.'}`
                : content.excerpts[0] || `${page === 'about' ? 'Learn more about' : 'See the work of'} ${name}.`, 165);
        pages[page] = {
            ...content, title, description: pageDescription, url: pageUrl(tenant.slug, available ? page : 'home'),
            robots: indexable && (available || publishedPages.length === 1 && page === 'book')
                ? (available ? 'index, follow, max-image-preview:large' : 'index, follow') : 'noindex, follow'
        };
    }
    return { brand, pages, publishedPages, services: serviceList, site };
}

function meta(attribute, key, content) {
    return content ? `<meta ${attribute}="${key}" content="${escapeHtml(content)}">` : '';
}

function structuredData(metadata, page) {
    const { brand, site, pages, services } = metadata;
    const home = pages.home.url;
    const id = home + '#business';
    const social = ['instagramUrl', 'facebookUrl', 'tiktokUrl', 'youtubeUrl', 'xUrl']
        .map(key => websiteUrl(site.social?.[key])).filter(Boolean);
    const phone = plainText(site.contact?.phone, 60);
    return {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'Organization', '@id': id, name: brand.name, url: home,
                logo: brand.logo, telephone: phone || undefined, address: brand.location || undefined,
                sameAs: social.length ? social : undefined,
                hasOfferCatalog: services.length ? {
                    '@type': 'OfferCatalog', name: 'Services',
                    itemListElement: services.map(service => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: service.name, description: service.description || undefined } }))
                } : undefined
            },
            { '@type': 'WebPage', '@id': pages[page].url + '#page', url: pages[page].url, name: pages[page].title, description: pages[page].description, about: { '@id': id } }
        ]
    };
}

function renderHead(metadata, page, slug) {
    const { brand, pages } = metadata;
    const { title, description, url, robots } = pages[page];
    const pageHeads = Object.fromEntries(Object.entries(pages).map(([id, data]) => (
        [id, { title: data.title, description: data.description, url: data.url, robots: data.robots }]
    )));
    return [
        `<title>${escapeHtml(title)}</title>`,
        meta('name', 'description', description), meta('name', 'robots', robots),
        `<link rel="canonical" href="${escapeHtml(url)}">`,
        meta('property', 'og:type', 'website'), meta('property', 'og:site_name', brand.name),
        meta('property', 'og:title', title), meta('property', 'og:description', description), meta('property', 'og:url', url),
        meta('property', 'og:image', brand.image), meta('property', 'og:image:alt', brand.image && brand.name),
        brand.formattedImage ? [
            meta('property', 'og:image:type', 'image/png'),
            meta('property', 'og:image:width', CARD_WIDTH), meta('property', 'og:image:height', CARD_HEIGHT)
        ].join('\n') : '',
        meta('name', 'twitter:card', brand.image ? 'summary_large_image' : 'summary'),
        meta('name', 'twitter:title', title), meta('name', 'twitter:description', description),
        meta('name', 'twitter:image', brand.image), meta('name', 'twitter:image:alt', brand.image && brand.name),
        meta('name', 'apple-mobile-web-app-title', brand.name),
        brand.logo ? `<link rel="icon" href="${escapeHtml(brand.logo)}"><link rel="apple-touch-icon" href="${escapeHtml(brand.logo)}">` : '',
        robots.startsWith('index') ? `<script type="application/ld+json">${safeJson(structuredData(metadata, page))}</script>` : '',
        `<script type="application/json" id="tenant-seo">${safeJson({ slug, pages: pageHeads })}</script>`
    ].filter(Boolean).join('\n');
}

function renderContent(metadata, page) {
    const { brand, pages, services, publishedPages } = metadata;
    const { heading, description, excerpts } = pages[page];
    const title = page === 'home' ? brand.name : page === 'book' ? `Book with ${brand.name}` : `${PAGE_LABELS[page]} · ${brand.name}`;
    return `<main style="max-width:52rem;margin:3rem auto;padding:0 1.25rem;font-family:system-ui,sans-serif;line-height:1.55">
        <nav aria-label="Business pages">${[...new Set([...publishedPages, 'book'])].map(id => `<a style="margin-right:1rem" href="${escapeHtml(id === 'book' ? pages.home.url + '/book' : pages[id].url)}">${PAGE_LABELS[id]}</a>`).join('')}</nav>
        <h1>${escapeHtml(title)}</h1>
        ${heading && heading !== title ? `<h2>${escapeHtml(heading)}</h2>` : ''}
        <p>${escapeHtml(description)}</p>
        ${excerpts.filter(text => text !== description).map(text => `<p>${escapeHtml(text)}</p>`).join('')}
        ${brand.location ? `<p>${escapeHtml(brand.location)}</p>` : ''}
        ${services.length && (page === 'home' || page === 'book') ? `<h2>Services</h2><ul>${services.map(service => `<li><strong>${escapeHtml(service.name)}</strong>${service.description ? ' · ' + escapeHtml(service.description) : ''}</li>`).join('')}</ul>` : ''}
        <noscript><p>Enable JavaScript to choose an appointment time and book online.</p></noscript>
    </main>`;
}

function renderTenantSitemap(tenants) {
    const urls = tenants.filter(isIndexable).flatMap(tenant => pageList(tenant.site_config || {}).map(page => pageUrl(tenant.slug, page)));
    return urls.map(url => `  <url><loc>${escapeHtml(url)}</loc></url>`).join('\n');
}

module.exports = {
    APP_ROUTES, CARD_HEIGHT, CARD_WIDTH, brandAssets, buildSiteMetadata, cardBackground, isTenantSlug,
    renderContent, renderHead, renderTenantSitemap
};
