const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const { sanitizeSiteConfig, themeKeyForName, THEME_KEYS, TEMPLATE_FILE_KEYS } = require('../server/services/siteConfig');
const gateways = require('../server/services/paymentGateways');
const { looksLikeDeclaredType, parseRange, kindForMime } = require('../server/services/media');

// ── Website config ───────────────────────────────────────────────────────────

test('site sanitiser strips unsafe links but keeps media, https and anchors', () => {
    const site = sanitizeSiteConfig({
        brand: { name: 'Shop', logoUrl: 'javascript:alert(1)' },
        hero: { imageUrl: '/media/93fcb692-3c96-4c7e-8a7c-a926cf2782d0', videoUrl: 'https://cdn.example.com/loop.mp4' },
        social: { instagramUrl: 'data:text/html,<script>' },
        nav: { link: '#contact' },
        pages: [{ id: 'home', sections: [{ type: 'hero', props: { posterUrl: 'vbscript:x' } }] }],
        __proto__: { polluted: true }
    });
    assert.equal(site.brand.logoUrl, '');
    assert.equal(site.hero.imageUrl, '/media/93fcb692-3c96-4c7e-8a7c-a926cf2782d0');
    assert.equal(site.hero.videoUrl, 'https://cdn.example.com/loop.mp4');
    assert.equal(site.social.instagramUrl, '');
    assert.equal(site.nav.link, '#contact');
    assert.equal(site.pages[0].sections[0].props.posterUrl, '');
    assert.equal({}.polluted, undefined);
    assert.equal(site.version, 1);
});

test('site sanitiser rejects non-objects and oversized documents', () => {
    assert.throws(() => sanitizeSiteConfig(null), /must be an object/);
    assert.throws(() => sanitizeSiteConfig([]), /must be an object/);
    assert.throws(() => sanitizeSiteConfig({ footer: { text: 'x'.repeat(300 * 1024) } }), /too large/);
});

test('every template maps to a website preset and a live demo', () => {
    const presetIndex = read('frontend/src/site/presets/index.js');
    const registry = read('frontend/src/themes/registry.js');
    for (const key of new Set(Object.values(THEME_KEYS))) {
        assert.ok(fs.existsSync(path.join(root, `frontend/src/site/presets/${key}.js`)), `missing preset for ${key}`);
        assert.match(presetIndex, new RegExp(key.includes('-') ? `'${key}'` : `\\b${key}\\b`));
        assert.match(registry, new RegExp(key.includes('-') ? `'${key}'` : `\\b${key}:`));
    }
    for (const key of Object.values(TEMPLATE_FILE_KEYS)) assert.ok(Object.values(THEME_KEYS).includes(key));
    assert.equal(themeKeyForName('Iron & Blade'), 'barber');
    assert.equal(themeKeyForName('Unknown'), 'universal');
});

test('each preset is individually designed with all four pages', () => {
    const fonts = new Set();
    for (const key of new Set(Object.values(THEME_KEYS))) {
        const source = read(`frontend/src/site/presets/${key}.js`);
        for (const pageId of ['home', 'about', 'gallery', 'book']) assert.match(source, new RegExp(`page\\('${pageId}'`), `${key} lacks ${pageId}`);
        assert.match(source, /section\('booking-main', 'booking'/, `${key} needs a booking widget`);
        const heading = source.match(/headingFont: '([^']+)'/)[1];
        fonts.add(heading);
    }
    assert.ok(fonts.size >= 8, 'templates should not all share the same typography');
});

// ── Payment gateways ─────────────────────────────────────────────────────────

test('gateway catalogue includes the Jamaican options', () => {
    for (const key of ['paypal', 'fygaro', 'easypay', 'fac', 'lynk', 'manual']) {
        assert.ok(gateways.GATEWAYS[key], `${key} missing`);
        assert.ok(gateways.PAYMENT_MODES.includes(key));
    }
    assert.ok(gateways.SERVICE_PAYMENT_MODES.includes('tenant_default'));
});

test('gateway settings are validated before saving', () => {
    assert.throws(() => gateways.normalizeGatewaySettings({ fygaro: { enabled: true, link: 'http://fygaro.com/x' } }), /https/);
    assert.throws(() => gateways.normalizeGatewaySettings({ fygaro: { enabled: true, link: 'https://evil.example/pay' } }), /fygaro\.com/);
    assert.throws(() => gateways.normalizeGatewaySettings({ easypay: { enabled: true, link: '' } }), /add your payment link/);
    assert.throws(() => gateways.normalizeGatewaySettings({ lynk: { enabled: true, handle: 'bad handle!' } }), /handle/);
    assert.throws(() => gateways.normalizeGatewaySettings({ fac: { link: 'https://x.test', amountParam: 'a b' } }), /parameter names/);

    const saved = gateways.normalizeGatewaySettings({
        fygaro: { enabled: true, link: 'https://www.fygaro.com/en/pb/abc' },
        lynk: { enabled: true, handle: 'myshop', accountName: 'My Shop' }
    }, { easypay: { enabled: false, link: 'https://pay.example' } });
    assert.equal(saved.lynk.handle, '@myshop');
    assert.equal(saved.fygaro.amountParam, 'amount');
    assert.equal(saved.easypay.link, 'https://pay.example', 'untouched gateways are preserved');
});

test('checkout links carry the amount and booking reference', () => {
    const tenant = { payment_settings: { gateways: { fygaro: { enabled: true, link: 'https://fygaro.com/en/pb/abc', amountParam: 'amount', referenceParam: 'client_note' } } } };
    const url = new URL(gateways.buildCheckoutUrl(tenant, 'fygaro', { amount: 4500, currency: 'jmd', reference: 'BK-1234ABCD' }));
    assert.equal(url.hostname, 'fygaro.com');
    assert.equal(url.searchParams.get('amount'), '4500.00');
    assert.equal(url.searchParams.get('client_note'), 'BK-1234ABCD');
    assert.equal(url.searchParams.get('currency'), 'JMD');

    const plain = { payment_settings: { gateways: { fac: { enabled: true, link: 'https://pay.bank.test/page', amountParam: '', referenceParam: '' } } } };
    assert.equal(gateways.buildCheckoutUrl(plain, 'fac', { amount: 10, currency: 'JMD', reference: 'BK-1' }), 'https://pay.bank.test/page');
});

test('public gateway summary never exposes merchant links or ids', () => {
    const tenant = {
        paypal_payments_enabled: true, paypal_payment_link: 'https://paypal.me/shop',
        manual_payment_enabled: false,
        payment_settings: { gateways: {
            fygaro: { enabled: true, link: 'https://fygaro.com/en/pb/secret', merchantId: 'M-1' },
            lynk: { enabled: true, handle: '@shop', accountName: 'Shop Ltd', instructions: 'Add your name' },
            easypay: { enabled: true, link: '' }
        } }
    };
    const summary = gateways.publicGatewaySummary(tenant);
    assert.equal(summary.paypal.enabled, true);
    assert.equal(summary.fygaro.enabled, true);
    assert.equal(summary.easypay.enabled, false, 'enabled without a link is not usable');
    assert.equal(summary.lynk.handle, '@shop');
    assert.doesNotMatch(JSON.stringify(summary), /secret|M-1|paypal\.me/);
});

test('booking flow and admin handle link and receipt gateways', () => {
    const route = read('server/routes/v1/bookings.js');
    assert.match(route, /isLinkGateway\(paymentMode\) && isGatewayEnabled\(tenant, paymentMode\)/);
    assert.match(route, /isReceiptGateway\(paymentMode\) && isGatewayEnabled\(tenant, paymentMode\)/);
    assert.match(route, /payment screenshot is required/);
    const ui = read('frontend/src/themes/SharedBookingTheme.jsx');
    assert.match(ui, /gateway\?\.kind === 'link'/);
    assert.match(ui, /gateway\?\.kind === 'receipt'/);
    const settings = read('admin/settings.html');
    for (const key of ['fygaro', 'easypay', 'fac', 'lynk']) assert.match(settings, new RegExp(`data-gateway="${key}"`));
    assert.match(read('admin/bookings.html'), /LINK_GATEWAY_LABELS/);
    assert.match(read('admin/services.html'), /value="fygaro"/);
});

// ── Media library ────────────────────────────────────────────────────────────

test('media uploads must match their declared type', () => {
    const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
    const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypmp42'), Buffer.alloc(8)]);
    assert.equal(looksLikeDeclaredType(png, 'image/png'), true);
    assert.equal(looksLikeDeclaredType(png, 'image/jpeg'), false);
    assert.equal(looksLikeDeclaredType(mp4, 'video/mp4'), true);
    assert.equal(looksLikeDeclaredType(Buffer.from('#!/bin/sh echo hi'), 'image/png'), false);
    assert.equal(kindForMime('video/mp4').kind, 'video');
    assert.equal(kindForMime('audio/mpeg').kind, 'audio');
    assert.equal(kindForMime('application/x-msdownload'), null);
});

test('media byte ranges support video seeking', () => {
    assert.deepEqual(parseRange('bytes=0-9', 100), { start: 0, end: 9 });
    assert.deepEqual(parseRange('bytes=90-', 100), { start: 90, end: 99 });
    assert.deepEqual(parseRange('bytes=-10', 100), { start: 90, end: 99 });
    assert.deepEqual(parseRange('bytes=50-500', 100), { start: 50, end: 99 });
    assert.equal(parseRange('bytes=200-300', 100), 'invalid');
    assert.equal(parseRange('items=0-1', 100), null);
});

// ── Wiring ───────────────────────────────────────────────────────────────────

test('CSP allows tenant background video, music and map embeds', () => {
    const app = read('server/app.js');
    assert.match(app, /mediaSrc:\["'self'",'https:','blob:','data:'\]/);
    // The builder decodes photos from blob: URLs to resize them before upload.
    assert.match(app, /imgSrc:\["'self'",'data:','https:','blob:'\]/);
    assert.match(app, /https:\/\/www\.google\.com/);
    assert.match(app, /app\.get\('\/media\/:id', serveMedia\)/);
});

test('website builder, playground and landing preview are wired up', () => {
    const customizer = read('admin/customize.html');
    assert.match(customizer, /js\/siteBuilder\.js/);
    assert.match(customizer, /new SiteBuilder\(/);
    assert.match(customizer, /icssWebsiteBuilderTour/);
    const builder = read('admin/js/siteBuilder.js');
    assert.match(builder, /event\.origin !== window\.location\.origin \|\| event\.source !== this\.iframe\.contentWindow/);
    assert.doesNotMatch(builder, /innerHTML/);
    const site = read('frontend/src/site/TenantWebsite.jsx');
    assert.match(site, /event\.origin !== window\.location\.origin \|\| event\.source !== parentWindow/);
    assert.match(read('frontend/src/App.jsx'), /\/demo\/:themeKey\/:page\?/);
    assert.match(read('public/playground.html'), /mode: 'demo'/);
    const home = read('public/index.html');
    assert.match(home, /id="your-space"/);
    assert.doesNotMatch(home, /onclick=/i);
    assert.match(read('public/js/marketing.js'), /initSpacePreview/);
});

test('dashboard tutorial covers the website builder and payment gateways', () => {
    const dashboard = read('admin/index.html');
    assert.match(dashboard, /data-tour="website-builder"/);
    assert.match(dashboard, /title: 'Website Builder'/);
    assert.match(dashboard, /title: 'Payment Gateways'/);
    assert.match(read('server/routes/v1/admin.js'), /MIN_DASHBOARD_TOUR_VERSION = 3/);
});

// ── Booking consent ──────────────────────────────────────────────────────────

test('every booking requires accepting the terms, enforced by the API', () => {
    const route = read('server/routes/v1/bookings.js');
    assert.match(route, /if \(terms_accepted !== true\)/);
    assert.match(route, /terms_accepted_at, terms_version/);
    assert.match(read('server/db/connection.js'), /ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ/);
    const ui = read('frontend/src/themes/SharedBookingTheme.jsx');
    assert.match(ui, /type="checkbox"\s+required\s+checked=\{termsAccepted\}/);
    assert.match(ui, /terms_accepted: termsAccepted/);
    assert.match(ui, /href="\/terms"/);
    assert.match(read('public/js/booking.js'), /terms_accepted: true/);
    assert.match(read('public/book.html'), /id="fieldTermsAccepted" required/);
    assert.match(read('frontend/src/site/siteSchema.js'), /bookingTerms:/);
});

// ── Guided tour robustness ───────────────────────────────────────────────────

test('guided tour is readable in light themes and never strands the overlay', () => {
    const css = read('admin/css/admin.css');
    assert.match(css, /\.tour-message \{\s*color: var\(--text-dim\)/);
    assert.match(css, /\.tour-step-count \{\s*color: var\(--info\)/);
    assert.match(css, /\.tour-context-label\[hidden\]/);
    const tour = read('admin/js/guidedTour.js');
    assert.match(tour, /ensureCardOnScreen\(\)/);
    assert.match(tour, /Watchdog/);
});
