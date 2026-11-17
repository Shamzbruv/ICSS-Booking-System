const kits = require('../../frontend/src/site/presets/career-starter-kits.json');

const retiredStarterNames = kits.filter(kit => kit.retired).map(kit => kit.name);

// Add starter choices without changing the defaults used by existing tenants.
async function seedCareerStarters(client) {
    for (const kit of kits.filter(kit => !kit.retired)) {
        await client.query(
            `INSERT INTO themes (name, category, preview_image_url, template_path, visual_config, business_config)
             VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
             ON CONFLICT (name) DO UPDATE SET preview_image_url = EXCLUDED.preview_image_url
             WHERE themes.preview_image_url IS NULL OR themes.preview_image_url = $7`,
            [kit.name, kit.category, kit.art, `/demo/${kit.key}`, JSON.stringify({ summary: kit.summary }), JSON.stringify({ services: kit.services }), `/images/starter-kits/template-${kit.key}.svg`]
        );
    }
}
module.exports = { seedCareerStarters, retiredStarterNames };
