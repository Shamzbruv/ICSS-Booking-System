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
    `);
    const { rows: existing } = await db.query('SELECT * FROM themes');
    await seedCareerStarters(db);
    await seedCareerStarters(db);
    const { rows } = await db.query('SELECT * FROM themes ORDER BY name');
    assert.equal(rows.length, 4);
    assert.equal(rows.find(row => row.name === 'Yaad Table Catering').template_path, '/demo/catering');
    assert.deepEqual(rows.find(row => row.name === 'Island Table Catering'), existing.find(row => row.name === 'Island Table Catering'));
    const driving = rows.find(row => row.name === 'Harbour Driving School');
    const originalDriving = existing.find(row => row.id === driving.id);
    assert.deepEqual(driving.business_config, originalDriving.business_config);
    assert.deepEqual(retiredStarterNames, ['Island Table Catering', 'Still & Motion Studio', 'Next Step Learning', 'YardReady Home Services']);

    for (const kit of kits) {
        assert.equal(themeKeyForName(kit.name), kit.key);
        if (!kit.retired) {
            const theme = rows.find(row => row.name === kit.name);
            assert.equal(theme.template_path, '/demo/' + kit.key);
            assert.equal(theme.preview_image_url, kit.art);
        }
        assert.ok(fs.existsSync(path.join(__dirname, '../public', kit.art)));
        const { default: preset } = await import('../frontend/src/site/presets/' + kit.key + '.js');
        assert.equal(preset.demo.services.length, kit.services.length);
        assert.equal(preset.site.pages.find(page => page.id === 'book').sections.some(section => section.type === 'booking'), true);
        assert.equal(sanitizeSiteConfig(preset.site).pages[0].sections[0].props.imageUrl, kit.art);
    }

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
