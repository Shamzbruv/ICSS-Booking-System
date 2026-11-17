const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const { seedCareerStarters } = require('../server/db/careerStarters');
const { seedStarterServices } = require('../server/services/provisioning');
const { sanitizeSiteConfig, themeKeyForName } = require('../server/services/siteConfig');
const kits = require('../frontend/src/site/presets/career-starter-kits.json');

test('professional templates seed their own previews and services without overwriting established themes', async (t) => {
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
    `);
    await seedCareerStarters(db);
    await seedCareerStarters(db);
    const { rows } = await db.query('SELECT * FROM themes ORDER BY name');
    assert.equal(rows.length, 7);
    assert.equal(rows.find(row => row.name === 'Yaad Table Catering').template_path, '/demo/catering');

    for (const kit of kits) {
        const theme = rows.find(row => row.name === kit.name);
        assert.equal(theme.template_path, '/demo/' + kit.key);
        assert.equal(themeKeyForName(theme.name), kit.key);
        assert.equal(theme.preview_image_url, kit.art);
        assert.ok(fs.existsSync(path.join(__dirname, '../public', kit.art)));
        const { default: preset } = await import('../frontend/src/site/presets/' + kit.key + '.js');
        assert.equal(preset.demo.services.length, kit.services.length);
        assert.equal(preset.site.pages.find(page => page.id === 'book').sections.some(section => section.type === 'booking'), true);
        assert.equal(sanitizeSiteConfig(preset.site).pages[0].sections[0].props.imageUrl, kit.art);
    }

    const driving = rows.find(row => row.template_path === '/demo/driving-lessons');
    await seedStarterServices('driving-owner', driving.id, db);
    await seedStarterServices('driving-owner', driving.id, db);
    const { rows: lessons } = await db.query("SELECT name, active, currency FROM services WHERE tenant_id = 'driving-owner' ORDER BY name");
    assert.equal(lessons.length, 4);
    assert.deepEqual(lessons.filter(row => row.active).map(row => row.name), ['Introductory Call']);
    assert.ok(lessons.every(row => row.currency === 'JMD'));
    await seedStarterServices('established-owner', rows.find(row => row.name === 'Yaad Table Catering').id, db);
    assert.equal((await db.query("SELECT active FROM services WHERE tenant_id = 'established-owner'")).rows[0].active, true);
});
