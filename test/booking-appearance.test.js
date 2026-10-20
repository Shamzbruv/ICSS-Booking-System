const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { sanitizeSiteConfig } = require('../server/services/siteConfig');

const schemaSource = fs.readFileSync(path.join(__dirname, '../frontend/src/site/siteSchema.js'), 'utf8');
const schema = import(`data:text/javascript;base64,${Buffer.from(schemaSource).toString('base64')}`);
const legacyTenant = {
    name: 'Existing business',
    branding: {
        logoUrl: 'https://example.com/logo.png', bookingTagline: 'Your old tagline', location: 'Kingston',
        serviceSectionImageUrl: 'https://example.com/service.jpg', bookingFooterNote: 'Your old note',
        badge1: 'Established locally', badge2: 'By appointment', stylists: ['Amelia', 'Chris'], timezone: 'America/Jamaica'
    }
};

test('existing booking content is inherited when opening the website builder', async () => {
    const { resolveSite, bookingBranding } = await schema;
    const resolved = resolveSite(legacyTenant, {}, null);
    const branding = bookingBranding(resolved);
    for (const key of ['logoUrl', 'bookingTagline', 'location', 'serviceSectionImageUrl', 'bookingFooterNote', 'badge1', 'badge2', 'stylists']) {
        assert.deepEqual(branding[key], legacyTenant.branding[key], `must preserve ${key}`);
    }
    assert.equal(resolved.brand.name, 'Existing business');
    assert.equal(resolved.pages.find(page => page.id === 'book').sections[0].type, 'booking');
});

test('builder edits survive saving and explicit removals do not revive old branding', async () => {
    const { resolveSite, bookingBranding } = await schema;
    const draft = resolveSite(legacyTenant, {}, null);
    draft.brand.logoUrl = '';
    draft.brand.tagline = '';
    draft.contact.address = 'Portmore';
    draft.booking.serviceSectionImageUrl = '';
    draft.booking.footerNote = 'Updated in Website Builder';
    draft.booking.badge1 = '';
    draft.booking.staff = [];
    const saved = sanitizeSiteConfig(draft);
    const reopened = resolveSite(legacyTenant, {}, saved);
    assert.deepEqual(bookingBranding(reopened), {
        logoUrl: '', bookingTagline: '', location: 'Portmore', serviceSectionImageUrl: '',
        bookingFooterNote: 'Updated in Website Builder', badge1: '', badge2: 'By appointment', stylists: []
    });
    assert.equal(bookingBranding(resolveSite(legacyTenant, {}, null)).bookingFooterNote, 'Your old note', 'an unpublished draft must not alter the legacy live content');
});

test('new industry presets resolve all pages, real service examples and editable booking content', async () => {
    const { resolveSite, bookingBranding } = await schema;
    const helperSource = fs.readFileSync(path.join(__dirname, '../frontend/src/site/presets/helpers.js'), 'utf8');
    const helperUrl = `data:text/javascript;base64,${Buffer.from(helperSource).toString('base64')}`;
    for (const key of ['landscaping', 'cleaning', 'party-rentals', 'car-rental', 'catering', 'detailing', 'home-repairs', 'tutoring', 'musicians']) {
        const source = fs.readFileSync(path.join(__dirname, `../frontend/src/site/presets/${key}.js`), 'utf8').replace("'./helpers'", JSON.stringify(helperUrl));
        const { default: preset } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
        const site = resolveSite({ name: 'My business' }, preset, null);
        assert.equal(preset.key, key);
        assert.deepEqual(site.pages.map(page => page.id), ['home', 'about', 'gallery', 'book']);
        assert.ok(site.pages.every(page => page.visible && page.sections.length >= 2));
        assert.ok(preset.demo.services.every(service => service.duration_minutes > 0 && service.price >= 0));
        assert.equal(site.brand.name, 'My business');
        assert.ok(bookingBranding(site).bookingTagline);
        assert.equal(site.pages.find(page => page.id === 'book').sections.filter(section => section.type === 'booking').length, 1);
        site.booking.footerNote = 'Bring your access details';
        assert.equal(bookingBranding(resolveSite({ name: 'My business' }, preset, sanitizeSiteConfig(site))).bookingFooterNote, 'Bring your access details');
    }
});
