/**
 * scripts/seed-platform-owner.js
 *
 * One-time script to promote an existing user to platform_owner role,
 * or create a new platform_owner if the email doesn't exist.
 *
 * Usage:
 *   node scripts/seed-platform-owner.js your@email.com [password]
 */

require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const email = process.argv[2];
const password = process.argv[3] || 'Password123!';

if (!email) {
    console.error('Usage: node scripts/seed-platform-owner.js your@email.com [password]');
    process.exit(1);
}

async function run() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    try {
        const checkRes = await pool.query(
            `SELECT id, email, name, role FROM users WHERE email = $1`,
            [email.toLowerCase().trim()]
        );

        if (checkRes.rows.length === 0) {
            console.log(`⚠️ No user found with email: ${email}. Creating new platform_owner...`);
            const passwordHash = await bcrypt.hash(password, 12);
            
            // We insert a user with NO tenant_id (platform_owner doesn't need one)
            await pool.query(
                `INSERT INTO users (email, password_hash, name, role, active)
                 VALUES ($1, $2, 'Platform Owner', 'platform_owner', true)`,
                [email.toLowerCase().trim(), passwordHash]
            );
            
            console.log('\n✅ Successfully created platform_owner.');
            console.log(`   Email:    ${email}`);
            console.log(`   Password: ${password}`);
            console.log('   You can now log in at /platform.\n');
            process.exit(0);
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
