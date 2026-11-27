async function migrateSiteTemplates(client) {
    await client.query(`
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS site_previous_template JSONB;
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS site_template_revision INTEGER NOT NULL DEFAULT 0;
    `);

    // Repair the verified test-site mismatch from the older theme switch.
    // Keep both saved documents so the original design can be restored.
    await client.query(`
        UPDATE tenants t SET
            site_previous_template=jsonb_build_object('theme_id',COALESCE((SELECT id FROM themes WHERE template_path='/demo/barber' LIMIT 1),t.theme_id),'site_draft',t.site_draft,
                'site_config',t.site_config,'site_published_at',t.site_published_at),
            site_draft=NULL, site_config=NULL, site_published_at=NULL,
            site_template_revision=site_template_revision + 1, updated_at=NOW()
        FROM themes th
        WHERE t.slug='icreate-testing-account' AND t.is_test_account
          AND t.theme_id=th.id AND th.template_path='/demo/car-rental'
          AND t.site_template_revision=0
          AND EXISTS (
              SELECT 1 FROM jsonb_path_query(t.site_config, '$.pages[*].sections[*] ? (@.type == "hero")') AS hero
              WHERE hero->'props'->>'headline'=$1
          )
    `, ['Sharp cuts.\nZero shortcuts.']);
}

module.exports = { migrateSiteTemplates };
