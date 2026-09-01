const { query } = require('../server/db/connection');

async function run() {
    try {
        console.log('--- Checking User ---');
        const userRes = await query(`SELECT * FROM users WHERE email = 'Shamzbiz1@gmail.com'`);
        console.log('User:', userRes.rows);

        if (userRes.rows.length > 0) {
            const tenantId = userRes.rows[0].tenant_id;
            console.log('\n--- Checking Tenant ---');
            const tenantRes = await query(`SELECT id, name, slug, active FROM tenants WHERE id = $1`, [tenantId]);
            console.log('Tenant:', tenantRes.rows);
        }
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
