const { query } = require('../server/db/connection');

async function updateEmail() {
    try {
        // Find the test account
        const tenantRes = await query(`SELECT id FROM tenants WHERE slug = 'icreate--testing-account'`);
        if (tenantRes.rows.length === 0) {
            console.log("Testing account not found.");
            process.exit(1);
        }
        const tenantId = tenantRes.rows[0].id;
        
        // Update the email of the tenant_admin for this tenant
        await query(
            `UPDATE users SET email = $1 WHERE tenant_id = $2 AND role = 'tenant_admin'`,
            ['icreatesolutions.ja@gmail.com', tenantId]
        );
        console.log("Email updated to iCreatesolutions.ja@gmail.com successfully.");
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
updateEmail();
