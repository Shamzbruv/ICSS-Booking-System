async function migratePlatformAnnouncements(client) {
    await client.query(`
        CREATE TABLE IF NOT EXISTS platform_announcements (
            id UUID PRIMARY KEY,
            author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            title TEXT NOT NULL,
            body TEXT NOT NULL,
            published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            withdrawn_at TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS platform_announcements_active
            ON platform_announcements (published_at DESC, id) WHERE withdrawn_at IS NULL;
        CREATE TABLE IF NOT EXISTS platform_announcement_dismissals (
            announcement_id UUID NOT NULL REFERENCES platform_announcements(id) ON DELETE CASCADE,
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (announcement_id, tenant_id, user_id)
        );
    `);
}

module.exports = { migratePlatformAnnouncements };
