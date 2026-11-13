async function migrateConsultations(client) {
    await client.query(`
        CREATE TABLE IF NOT EXISTS consultation_hosts (
            id TEXT PRIMARY KEY,
            enabled BOOLEAN NOT NULL DEFAULT false,
            hours JSONB NOT NULL DEFAULT '{}',
            blocked_dates TEXT[] NOT NULL DEFAULT '{}',
            meeting_url TEXT NOT NULL DEFAULT ''
        )
    `);
    await client.query(`INSERT INTO consultation_hosts (id) VALUES ('shamar'), ('jemelia') ON CONFLICT DO NOTHING`);
    await client.query(`
        CREATE TABLE IF NOT EXISTS consultations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            host_id TEXT NOT NULL REFERENCES consultation_hosts(id),
            starts_at TIMESTAMPTZ NOT NULL,
            status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','cancelled','completed','no_show')),
            client_name TEXT NOT NULL,
            email TEXT NOT NULL,
            company TEXT NOT NULL DEFAULT '',
            topic TEXT NOT NULL,
            details TEXT NOT NULL DEFAULT '',
            meeting_url TEXT NOT NULL DEFAULT '',
            staff_notes TEXT NOT NULL DEFAULT '',
            version INT NOT NULL DEFAULT 1,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS consultation_host_slot
        ON consultations (host_id, starts_at) WHERE status = 'confirmed'
    `);
    await client.query(`ALTER TABLE consultations ADD COLUMN IF NOT EXISTS joint BOOLEAN NOT NULL DEFAULT false`);
    await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS consultation_shamar_slot ON consultations (starts_at)
        WHERE status = 'confirmed' AND (host_id = 'shamar' OR joint)
    `);
    await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS consultation_jemelia_slot ON consultations (starts_at)
        WHERE status = 'confirmed' AND (host_id = 'jemelia' OR joint)
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS consultation_start ON consultations (starts_at DESC)`);
}

module.exports = { migrateConsultations };
