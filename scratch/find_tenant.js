const { query } = require('../server/db/connection');

async function run() {
    try {
        const res = await query('SELECT id, name, slug FROM tenants');
        console.log(res.rows);
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
