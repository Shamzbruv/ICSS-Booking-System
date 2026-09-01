const { query } = require('../server/db/connection');
const EMAIL = 'Shamzbiz1@gmail.com';
const TENANT_ID = 'd45e3755-6675-44b9-9ac9-6eb073d115a3'; // iCreate - Testing Account

async function run() {
    try {
        const res = await query(
            `UPDATE users 
             SET role = 'tenant_admin' 
             WHERE tenant_id = $1 AND email = $2
             RETURNING id, name, email, role`,
            [TENANT_ID, EMAIL]
        );
        console.log('Successfully updated role to tenant_admin:', res.rows[0]);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
