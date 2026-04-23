/**
 * scripts/seed-platform-owner.js
 *
 * One-time script to promote an existing user to platform_owner role.
 * This is the ONLY way to create a platform_owner account.
 * There is no self-service path.
 *
 * Usage:
 *   node scripts/seed-platform-owner.js your@email.com
 *
 * The user must already exist in the database.
 * Their role will be updated to 'platform_owner'.
 * Their tenant_id association is preserved (but the login flow
 * will authenticate them as platform_owner first, bypassing tenant resolution).
 */

require('dotenv').config();
const { Pool } = require('pg');

const email = process.argv[2];

if (!email) {
    console.error('Usage: node scripts/seed-platform-owner.js your@email.com');
    process.exit(1);
}

async function run() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    try {
        // Check the user exists
        const checkRes = await pool.query(
            `SELECT id, email, name, role FROM users WHERE email = $1`,
            [email.toLowerCase().trim()]
        );

        if (checkRes.rows.length === 0) {
            console.error(`❌ No user found with email: ${email}`);
            console.error('   Make sure you use the exact email address from the users table.');
            process.exit(1);
        }

        const user = checkRes.rows[0];
        console.log(`\n📋 Found user:`);
        console.log(`   ID:    ${user.id}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Name:  ${user.name}`);
        console.log(`   Role:  ${user.role} → platform_owner`);

        if (user.role === 'platform_owner') {
            console.log('\n✅ User is already platform_owner. No changes made.\n');
            process.exit(0);
        }

        // Promote to platform_owner
        await pool.query(
            `UPDATE users SET role = 'platform_owner' WHERE id = $1`,
            [user.id]
        );

        console.log('\n✅ Successfully promoted to platform_owner.');
        console.log('   You can now log in at /platform with this email and password.\n');

    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

run();
