async function migratePatientWorkspace(client) {
    await client.query(`
        CREATE TABLE IF NOT EXISTS booking_patients (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            profile_ciphertext TEXT NOT NULL,
            lookup_keys TEXT[] NOT NULL,
            archived_at TIMESTAMPTZ,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (tenant_id,id)
        );
        CREATE INDEX IF NOT EXISTS booking_patients_directory ON booking_patients(tenant_id,archived_at,updated_at DESC,id);
        CREATE INDEX IF NOT EXISTS booking_patients_lookup ON booking_patients USING GIN(lookup_keys);
        CREATE UNIQUE INDEX IF NOT EXISTS bookings_tenant_patient_link_key ON bookings(tenant_id,id);
        CREATE TABLE IF NOT EXISTS patient_booking_links (
            booking_id UUID PRIMARY KEY,
            tenant_id UUID NOT NULL,
            patient_id UUID NOT NULL,
            FOREIGN KEY (tenant_id,booking_id) REFERENCES bookings(tenant_id,id) ON DELETE CASCADE,
            FOREIGN KEY (tenant_id,patient_id) REFERENCES booking_patients(tenant_id,id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS patient_booking_links_profile ON patient_booking_links(tenant_id,patient_id);
    `);
}

module.exports = { migratePatientWorkspace };
