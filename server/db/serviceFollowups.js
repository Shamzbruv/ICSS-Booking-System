async function migrateServiceFollowups(client) {
    await client.query(`ALTER TABLE services ADD COLUMN IF NOT EXISTS followup JSONB NOT NULL DEFAULT '{}'`);
    await client.query(`
        CREATE TABLE IF NOT EXISTS service_followups (
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
            email TEXT NOT NULL,
            booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
            visit_at TIMESTAMPTZ NOT NULL,
            visit_date DATE NOT NULL,
            delivery_id UUID NOT NULL DEFAULT gen_random_uuid(),
            token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
            status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','sending','sent','skipped','failed','unsubscribed')),
            attempts INTEGER NOT NULL DEFAULT 0,
            ready_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            first_attempt_at TIMESTAMPTZ,
            sent_at TIMESTAMPTZ,
            message JSONB,
            PRIMARY KEY (tenant_id, service_id, email)
        )`);
    await client.query(`CREATE INDEX IF NOT EXISTS bookings_followup_client
                       ON bookings(tenant_id,service_id,LOWER(TRIM(email)))
                       WHERE status IN ('completed','confirmed')`);
    await client.query(`CREATE INDEX IF NOT EXISTS service_followups_ready ON service_followups(ready_at)
                       WHERE status IN ('scheduled','sending')`);
}

module.exports = { migrateServiceFollowups };
