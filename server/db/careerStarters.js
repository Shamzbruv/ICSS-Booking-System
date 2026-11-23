const kits = require('../../frontend/src/site/presets/career-starter-kits.json');

const retiredStarterNames = kits.filter(kit => kit.retired).map(kit => kit.name);

const originalPastoralServices = [
    {"name": "First Visit Conversation", "description": "Ask about the service schedule, directions or accessibility.", "duration_minutes": 15, "price": 0, "active": true},
    {"name": "Ministry Introduction", "description": "Talk about the ministry and ways to get involved. Keep sensitive details for private follow-up.", "duration_minutes": 20, "price": 0, "active": true},
    {"name": "Speaking Invitation Call", "description": "Discuss the event, audience and topic. This does not confirm the pastor for your event.", "duration_minutes": 30, "price": 0, "active": true}
];

// Add starter choices without changing the defaults used by existing tenants.
async function seedCareerStarters(client) {
    // Upgrade the catalog listing in place so existing signups keep their theme ID.
    const expert = kits.find(kit => kit.key === 'expert-booking');
    await client.query(
        `UPDATE themes SET name = $1,
             visual_config = COALESCE(visual_config, '{}'::jsonb) || jsonb_build_object('summary', $2::text)
         WHERE name = 'Expert Booking Page' AND template_path = $3
             AND NOT EXISTS (SELECT 1 FROM themes WHERE name = $1)`,
        [expert.name, expert.summary, `/demo/${expert.key}`]
    );

    for (const kit of kits.filter(kit => !kit.retired)) {
        await client.query(
            `INSERT INTO themes (name, category, preview_image_url, template_path, visual_config, business_config)
             VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
             ON CONFLICT (name) DO UPDATE SET preview_image_url = EXCLUDED.preview_image_url
             WHERE themes.preview_image_url IS NULL OR themes.preview_image_url = $7`,
            [kit.name, kit.category, kit.art, `/demo/${kit.key}`, JSON.stringify({ summary: kit.summary }), JSON.stringify({ services: kit.services }), `/images/starter-kits/template-${kit.key}.svg`]
        );
    }

    // Refresh the original pastor catalog entry for future signups. Tenant services live in their own rows.
    const pastor = kits.find(kit => kit.key === 'pastor-ministry');
    await client.query(
        `UPDATE themes
         SET category = $2,
             visual_config = jsonb_set(visual_config, '{summary}', to_jsonb($3::text)),
             business_config = jsonb_set(business_config, '{services}', $4::jsonb)
         WHERE name = $1 AND category = 'Pastor & Ministry' AND business_config->'services' = $5::jsonb`,
        [pastor.name, pastor.category, pastor.summary, JSON.stringify(pastor.services), JSON.stringify(originalPastoralServices)]
    );
}
module.exports = { seedCareerStarters, retiredStarterNames };
