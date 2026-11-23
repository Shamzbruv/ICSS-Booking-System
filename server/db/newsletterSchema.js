async function migrateNewsletter(client) {
    await client.query(`
        ALTER TABLE tenants ADD COLUMN IF NOT EXISTS email_reply_to TEXT;
        CREATE TABLE IF NOT EXISTS newsletter_settings (
            tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
            enabled BOOLEAN NOT NULL DEFAULT false,
            design JSONB NOT NULL DEFAULT '{}'
        );
        CREATE TABLE IF NOT EXISTS newsletter_subscribers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            email TEXT NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('pending', 'subscribed', 'unsubscribed')),
            confirm_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
            unsubscribe_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
            requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            subscribed_at TIMESTAMPTZ,
            unsubscribed_at TIMESTAMPTZ,
            UNIQUE (tenant_id, email),
            UNIQUE (tenant_id, id)
        );
        CREATE INDEX IF NOT EXISTS newsletter_subscribers_list
            ON newsletter_subscribers (tenant_id, status, requested_at DESC);
        CREATE TABLE IF NOT EXISTS newsletter_campaigns (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            request_id UUID NOT NULL,
            subject TEXT NOT NULL,
            message JSONB NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (tenant_id, request_id),
            UNIQUE (tenant_id, id)
        );
        CREATE INDEX IF NOT EXISTS newsletter_campaigns_history ON newsletter_campaigns (tenant_id, created_at DESC);
        CREATE TABLE IF NOT EXISTS newsletter_deliveries (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            campaign_id UUID NOT NULL,
            subscriber_id UUID NOT NULL,
            status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sending','sent','failed','skipped')),
            attempts INTEGER NOT NULL DEFAULT 0,
            ready_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            first_attempt_at TIMESTAMPTZ,
            provider_message_id TEXT,
            FOREIGN KEY (tenant_id, campaign_id) REFERENCES newsletter_campaigns(tenant_id, id) ON DELETE CASCADE,
            FOREIGN KEY (tenant_id, subscriber_id) REFERENCES newsletter_subscribers(tenant_id, id) ON DELETE CASCADE,
            UNIQUE (campaign_id, subscriber_id)
        );
        CREATE INDEX IF NOT EXISTS newsletter_delivery_queue ON newsletter_deliveries (ready_at, id)
            WHERE status IN ('queued', 'sending');
    `);
}

module.exports = { migrateNewsletter };
