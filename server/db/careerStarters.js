const kits = require('../../frontend/src/site/presets/career-starter-kits.json');

// Add starter choices without changing the defaults used by existing tenants.
async function seedCareerStarters(client) {
    for (const kit of kits) {
        await client.query(
            `INSERT INTO themes (name, category, preview_image_url, template_path, visual_config, business_config)
             VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb) ON CONFLICT (name) DO NOTHING`,
            [kit.name, kit.category, kit.art, `/demo/${kit.key}`, JSON.stringify({ summary: kit.summary }), JSON.stringify({ services: kit.services })]
        );
    }
}
module.exports = { seedCareerStarters };
