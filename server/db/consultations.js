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
    await client.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint
            WHERE conrelid='consultations'::regclass AND conname='consultations_approval_status_check') THEN
            ALTER TABLE consultations DROP CONSTRAINT IF EXISTS consultations_status_check;
            ALTER TABLE consultations ADD CONSTRAINT consultations_approval_status_check
                CHECK (status IN ('pending','confirmed','cancelled','completed','no_show'));
        END IF;
    END $$`);
    await client.query(`ALTER TABLE consultations ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES users(id) ON DELETE SET NULL`);
    await client.query(`ALTER TABLE consultations ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ`);
    await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS consultation_shamar_hold ON consultations (starts_at)
        WHERE status IN ('pending','confirmed') AND (host_id = 'shamar' OR joint)
    `);
    await client.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS consultation_jemelia_hold ON consultations (starts_at)
        WHERE status IN ('pending','confirmed') AND (host_id = 'jemelia' OR joint)
    `);
    await client.query(`ALTER TABLE consultations ADD COLUMN IF NOT EXISTS outcome TEXT
        CHECK (outcome IN ('lead', 'lost'))`);
    await client.query(`ALTER TABLE consultations ADD COLUMN IF NOT EXISTS outcome_by UUID REFERENCES users(id) ON DELETE SET NULL`);
    await client.query(`ALTER TABLE consultations ADD COLUMN IF NOT EXISTS outcome_at TIMESTAMPTZ`);
    await client.query(`CREATE INDEX IF NOT EXISTS consultation_start ON consultations (starts_at DESC)`);
}

module.exports = { migrateConsultations };
