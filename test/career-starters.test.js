const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const { seedCareerStarters, retiredStarterNames } = require('../server/db/careerStarters');
const { seedStarterServices } = require('../server/services/provisioning');
const { sanitizeSiteConfig, themeKeyForName } = require('../server/services/siteConfig');
const kits = require('../frontend/src/site/presets/career-starter-kits.json');

test('active starter templates refresh their default previews and preserve existing theme records', async (t) => {
    const db = new PGlite();
    t.after(() => db.close());
    await db.exec(`
        CREATE TABLE themes (id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, name TEXT UNIQUE, category TEXT,
            preview_image_url TEXT, template_path TEXT, visual_config JSONB, business_config JSONB);
        CREATE TABLE services (tenant_id TEXT, name TEXT, description TEXT, duration_minutes INT,
            price NUMERIC, currency TEXT, active BOOLEAN DEFAULT TRUE);
        INSERT INTO themes (name, category, template_path, business_config)
        VALUES ('Yaad Table Catering', 'Catering', '/demo/catering',
            '{"services":[{"name":"Tasting","duration_minutes":30,"price":1000}]}');
        INSERT INTO themes (name, category, preview_image_url, template_path, business_config) VALUES
            ('Harbour Driving School', 'Driving Lessons', '/images/starter-kits/template-driving-lessons.svg', '/demo/driving-lessons',
             '{"services":[{"name":"Existing lesson","duration_minutes":45,"price":1000}]}'),
            ('Island Table Catering', 'Catering & Events', '/images/starter-kits/template-catering.svg', '/demo/catering-events', '{}');
        INSERT INTO themes (name, category, template_path, visual_config, business_config)
        VALUES ('Open Door Ministry', 'Pastor & Ministry', '/demo/pastor-ministry', '{"summary":"Original description","custom":true}',
            '{"custom":true,"services":[
              {"name":"First Visit Conversation","description":"Ask about the service schedule, directions or accessibility.","duration_minutes":15,"price":0,"active":true},
              {"name":"Ministry Introduction","description":"Talk about the ministry and ways to get involved. Keep sensitive details for private follow-up.","duration_minutes":20,"price":0,"active":true},
              {"name":"Speaking Invitation Call","description":"Discuss the event, audience and topic. This does not confirm the pastor for your event.","duration_minutes":30,"price":0,"active":true}
            ]}');
        INSERT INTO services (tenant_id, name, active) VALUES ('existing-pastor', 'Existing appointment', true);
    `);
    const { rows: existing } = await db.query('SELECT * FROM themes');
    await seedCareerStarters(db);
    await seedCareerStarters(db);
    const { rows } = await db.query('SELECT * FROM themes ORDER BY name');
    assert.equal(rows.length, 12);
    assert.equal(rows.find(row => row.name === 'Yaad Table Catering').template_path, '/demo/catering');
    assert.deepEqual(rows.find(row => row.name === 'Island Table Catering'), existing.find(row => row.name === 'Island Table Catering'));
    const driving = rows.find(row => row.name === 'Harbour Driving School');
    const originalDriving = existing.find(row => row.id === driving.id);
    assert.deepEqual(driving.business_config, originalDriving.business_config);
    assert.deepEqual(retiredStarterNames, ['Island Table Catering', 'Still & Motion Studio', 'Next Step Learning', 'YardReady Home Services']);

    const { TRADE_PRESETS } = await import('../frontend/src/site/presets/trade-starters.js');
    const pastor = rows.find(row => row.name === 'Open Door Ministry');
    assert.equal(pastor.id, existing.find(row => row.name === pastor.name).id);
    assert.equal(pastor.category, 'Pastoral Care');
    assert.equal(pastor.visual_config.custom, true);
    assert.equal(pastor.business_config.custom, true);
    await seedStarterServices('new-pastor', pastor.id, db);
    await seedStarterServices('existing-pastor', pastor.id, db);
    assert.deepEqual((await db.query("SELECT name FROM services WHERE tenant_id = 'new-pastor' ORDER BY name")).rows.map(row => row.name), [
        'Follow-up Appointment', 'Member Meeting', 'Pastoral Counseling', 'Prayer & Spiritual Guidance'
    ]);
    assert.deepEqual((await db.query("SELECT name FROM services WHERE tenant_id = 'existing-pastor'")).rows, [{ name: 'Existing appointment' }]);

    for (const kit of kits) {
        assert.equal(themeKeyForName(kit.name), kit.key);
        if (!kit.retired) {
            const theme = rows.find(row => row.name === kit.name);
            assert.equal(theme.template_path, '/demo/' + kit.key);
            assert.equal(theme.preview_image_url, kit.art);
        }
        assert.ok(fs.existsSync(path.join(__dirname, '../public', kit.art)));
        const preset = TRADE_PRESETS[kit.key] || (await import('../frontend/src/site/presets/' + kit.key + '.js')).default;
        assert.equal(preset.demo.services.length, kit.services.length);
        assert.equal(preset.site.pages.find(page => page.id === 'book').sections.some(section => section.type === 'booking'), true);
        if (preset.site.enabled !== false) {
            assert.equal(sanitizeSiteConfig(preset.site).pages[0].sections[0].props.imageUrl, kit.art);
        }
        if (kit.trade) {
            const image = sanitizeSiteConfig(preset.site).pages[0].sections[0].props.mobileImageUrl;
            assert.equal(image, kit.art.replace('.webp', '-mobile.webp'));
            assert.ok(fs.existsSync(path.join(__dirname, '../public', image)));
        }
    }

    const expert = rows.find(row => row.template_path === '/demo/expert-booking');
    await seedStarterServices('new-advisor', expert.id, db);
    const { rows: consultations } = await db.query("SELECT name, duration_minutes, price, active FROM services WHERE tenant_id = 'new-advisor' ORDER BY duration_minutes");
    assert.deepEqual(consultations, [
        { name: 'Introductory Call', duration_minutes: 15, price: '0', active: true },
        { name: 'Expert Consultation', duration_minutes: 30, price: '0', active: false },
        { name: 'Deep-Dive Session', duration_minutes: 60, price: '0', active: false }
    ]);
    const { default: expertPreset } = await import('../frontend/src/site/presets/expert-booking.js');
    const { resolveSite } = await import('../frontend/src/site/siteSchema.js');
    const advisorSite = resolveSite({ name: 'New advisor' }, expertPreset, null);
    assert.equal(sanitizeSiteConfig(advisorSite).enabled, false);
    assert.equal(advisorSite.brand.name, 'New advisor');
    assert.equal(resolveSite({ name: 'New advisor' }, expertPreset, { enabled: true }).enabled, true);

    const influencerTheme = rows.find(row => row.template_path === '/demo/influencers');
    await seedStarterServices('creator-owner', influencerTheme.id, db);
    const { rows: pitches } = await db.query("SELECT name, active, currency FROM services WHERE tenant_id = 'creator-owner' ORDER BY name");
    assert.deepEqual(pitches.map(row => row.name), [
        'Brand Partnership Call', 'Creator Collaboration Call', 'Event Hosting & Appearances Call', 'UGC & Content Production Call'
    ]);
    assert.ok(pitches.every(row => row.active && row.currency === 'JMD'));
    const { default: influencer } = await import('../frontend/src/site/presets/influencers.js');
    const portfolio = influencer.site.pages.find(page => page.id === 'gallery');
    assert.deepEqual(portfolio.sections.find(section => section.type === 'gallery').props.images, []);
    for (const photo of influencer.demo.galleryImages) {
        assert.ok(fs.existsSync(path.join(__dirname, '../public', photo.url)));
    }
    const mobileHero = sanitizeSiteConfig(influencer.site).pages[0].sections[0].props.mobileImageUrl;
    assert.ok(fs.existsSync(path.join(__dirname, '../public', mobileHero)));

    await db.query('DELETE FROM themes WHERE id = $1', [driving.id]);
    await seedCareerStarters(db);
    const { rows: freshDriving } = await db.query("SELECT id FROM themes WHERE template_path = '/demo/driving-lessons'");
    await seedStarterServices('driving-owner', freshDriving[0].id, db);
    await seedStarterServices('driving-owner', freshDriving[0].id, db);
    const { rows: lessons } = await db.query("SELECT name, active, currency FROM services WHERE tenant_id = 'driving-owner' ORDER BY name");
    assert.equal(lessons.length, 4);
    assert.deepEqual(lessons.filter(row => row.active).map(row => row.name), ['Introductory Call']);
    assert.ok(lessons.every(row => row.currency === 'JMD'));
    await seedStarterServices('established-owner', rows.find(row => row.name === 'Yaad Table Catering').id, db);
    assert.equal((await db.query("SELECT active FROM services WHERE tenant_id = 'established-owner'")).rows[0].active, true);
});

test('trade and pastoral starters ship complete pages and keep sample contact details out of tenant sites', async () => {
    const { TRADE_PRESETS } = await import('../frontend/src/site/presets/trade-starters.js');
    const { default: pastor } = await import('../frontend/src/site/presets/pastor-ministry.js');
    const { resolveSite } = await import('../frontend/src/site/siteSchema.js');
    for (const preset of [pastor, ...Object.values(TRADE_PRESETS)]) {
        const { contact: sample } = preset.demo;
        assert.match(sample.email, /@example\.com$/);
        assert.ok(sample.address && sample.phone && sample.hours.length);
        const site = resolveSite({ name: 'New tenant' }, preset, null);
        const [home, services, process, book] = site.pages;
        assert.ok(home.sections.some(section => section.type === 'contact' && section.props.showMap === false));
        assert.ok(services.sections.some(section => section.type === 'services'));
        assert.ok(process.sections.some(section => section.type === 'faq' && section.props.items.length >= 2));
        assert.ok(book.sections.some(section => section.type === 'booking'));
        assert.deepEqual(site.contact, { address: '', phone: '', whatsapp: '', email: '', mapQuery: '' });
        assert.deepEqual(home.sections.find(section => section.type === 'contact').props.hours, []);
        const realContact = { address: 'Tenant service area', email: 'office@example.org' };
        assert.equal(resolveSite({ name: 'Existing tenant' }, preset, { contact: realContact }).contact.email, realContact.email);
    }
});
