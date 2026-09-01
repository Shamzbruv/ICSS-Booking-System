const { query } = require('../server/db/connection');
const bcrypt = require('bcryptjs');

const TENANT_ID = 'd45e3755-6675-44b9-9ac9-6eb073d115a3'; // iCreate - Testing Account
const EMAIL = 'Shamzbiz1@gmail.com';

async function run() {
    try {
        // Hash a default password just in case they try to login directly
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash('Password123!', salt);

        const res = await query(
            `INSERT INTO users (tenant_id, email, password_hash, name, role, active)
             VALUES ($1, $2, $3, 'Test Admin', 'admin', true)
             ON CONFLICT (tenant_id, email) DO UPDATE 
             SET role = 'admin', active = true
             RETURNING id, name, email, role`,
            [TENANT_ID, EMAIL, passwordHash]
        );
        console.log('Successfully added/updated admin user:', res.rows[0]);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
