/**
 * ICSS Booking System — Database Connection
 * Uses PostgreSQL via the `pg` library with a connection pool.
 * Falls back to a simple SQLite-compatible mode for local dev
 * (set DATABASE_URL=sqlite://./dev.db in .env).
 *
 * All queries are exposed through a unified `query(sql, params)` interface
 * so the database driver can be swapped without touching routes.
 */

require('dotenv').config();
const { Pool } = require('pg');

let pool;

function getPool() {
    if (!pool) {
        const connectionString = process.env.DATABASE_URL;

        if (!connectionString) {
            throw new Error(
                'DATABASE_URL environment variable is required. ' +
                'See .env.example for setup instructions.'
            );
        }

        pool = new Pool({
            connectionString,
            ssl: process.env.NODE_ENV === 'production'
                ? { rejectUnauthorized: false }  // Required for Railway/Render
                : false,
            max: 20,             // Max pool connections
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
        });

        pool.on('error', (err) => {
            console.error('❌ Unexpected PostgreSQL pool error:', err.message);
        });
    }
    return pool;
}

/**
 * Execute a SQL query against the PostgreSQL pool.
 * @param {string} sql - Parameterized SQL string (use $1, $2 placeholders)
 * @param {Array}  params - Parameter values
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(sql, params = []) {
    const client = getPool();
    return client.query(sql, params);
}

/**
 * Initialize the database — run migrations to create tables if they don't exist.
 * Called once on server boot.
 */
async function initDatabase() {
    const client = await getPool().connect();
    try {
        console.log('🔗 Connected to PostgreSQL database.');
        await runMigrations(client);
        console.log('✅ Database schema up to date.');
    } catch (err) {
        console.error('❌ Database initialization failed:', err.message);
        throw err;
    } finally {
        client.release();
    }
}

/**
 * Run all schema migrations in sequence.
 * This is a lightweight inline migration runner — for production use,
 * consider migrating to Knex.js migrations for a proper up/down workflow.
 */
async function runMigrations(client) {
    // Enable UUID generation
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    // ── Plans (reference table, seeded below) ────────────────────────────────
    await client.query(`
        CREATE TABLE IF NOT EXISTS plans (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            price_monthly NUMERIC DEFAULT 0,
            features JSONB DEFAULT '{}',
            limits JSONB DEFAULT '{}'
        )
    `);

    // ── Tenants ───────────────────────────────────────────────────────────────
    await client.query(`
        CREATE TABLE IF NOT EXISTS tenants (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            slug TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            plan_id TEXT REFERENCES plans(id) DEFAULT 'starter',
            features JSONB DEFAULT '{}',
            limits JSONB DEFAULT '{}',
            branding JSONB DEFAULT '{}',
            active BOOLEAN DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);

    // ── Users ─────────────────────────────────────────────────────────────────
    await client.query(`
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
            email TEXT NOT NULL,
            password_hash TEXT,
            name TEXT,
            role TEXT DEFAULT 'customer',
            active BOOLEAN DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(tenant_id, email)
        )
    `);

    // ── Services / Resource Catalog ───────────────────────────────────────────
    await client.query(`
        CREATE TABLE IF NOT EXISTS services (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            description TEXT,
            duration_minutes INT DEFAULT 30,
            price NUMERIC DEFAULT 0,
            currency TEXT DEFAULT 'JMD',
            active BOOLEAN DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);

    // ── Bookings ──────────────────────────────────────────────────────────────
    await client.query(`
        CREATE TABLE IF NOT EXISTS bookings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
            user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            service_id UUID REFERENCES services(id) ON DELETE SET NULL,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT,
            booking_date DATE NOT NULL,
            booking_time TIME NOT NULL,
            notes TEXT,
            region TEXT DEFAULT 'Jamaica',
            status TEXT DEFAULT 'confirmed',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(tenant_id, booking_date, booking_time)
        )
    `);

    // Indexes for fast tenant-scoped lookups
    await client.query(`CREATE INDEX IF NOT EXISTS idx_bookings_tenant_date ON bookings(tenant_id, booking_date)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_bookings_tenant_email ON bookings(tenant_id, email)`);

    // ── Orders ────────────────────────────────────────────────────────────────
    await client.query(`
        CREATE TABLE IF NOT EXISTS orders (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
            user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            session_id TEXT UNIQUE,
            customer_name TEXT,
            customer_email TEXT,
            customer_phone TEXT,
            shipping_address TEXT,
            city TEXT,
            country TEXT,
            status TEXT DEFAULT 'draft',
            total_amount NUMERIC,
            currency TEXT DEFAULT 'USD',
            payment_ref TEXT,
            notes TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS order_items (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
            tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
            suit_name TEXT,
            gender TEXT,
            measurements JSONB,
            price NUMERIC
        )
    `);

    // ── Payments ──────────────────────────────────────────────────────────────
    await client.query(`
        CREATE TABLE IF NOT EXISTS payments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
            order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
            booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
            provider TEXT DEFAULT 'wipay',
            transaction_id TEXT,
            amount NUMERIC,
            currency TEXT,
            status TEXT DEFAULT 'pending',
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);

    // ── Unavailable Slots (Admin Controlled) ──────────────────────────────────
    await client.query(`
        CREATE TABLE IF NOT EXISTS unavailable_slots (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
            block_type TEXT NOT NULL,
            block_date DATE NOT NULL,
            block_time TIME,
            reason TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);

    // ── Design Inquiries ──────────────────────────────────────────────────────
    await client.query(`
        CREATE TABLE IF NOT EXISTS design_inquiries (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
            customer_name TEXT NOT NULL,
            customer_email TEXT NOT NULL,
            customer_phone TEXT,
            design_name TEXT,
            gender TEXT,
            fabric TEXT,
            target_date DATE,
            description TEXT,
            booking_date DATE,
            booking_time TIME,
            has_photo BOOLEAN DEFAULT false,
            status TEXT DEFAULT 'new',
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);

    // ── Audit Log ─────────────────────────────────────────────────────────────
    await client.query(`
        CREATE TABLE IF NOT EXISTS audit_log (
            id BIGSERIAL PRIMARY KEY,
            tenant_id UUID,
            user_id UUID,
            action TEXT NOT NULL,
            entity TEXT,
            entity_id TEXT,
            metadata JSONB DEFAULT '{}',
            ip_address TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_log(tenant_id, created_at DESC)`);

    // ── Deposit Sessions ──────────────────────────────────────────────────────
    await client.query(`
        CREATE TABLE IF NOT EXISTS deposit_sessions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
            deposit_id TEXT UNIQUE NOT NULL,
            customer_name TEXT,
            customer_email TEXT,
            customer_phone TEXT,
            design_data JSONB,
            amount NUMERIC DEFAULT 0,
            currency TEXT DEFAULT 'JMD',
            status TEXT DEFAULT 'pending',
            payment_ref TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);

    // ── Seed Plans ────────────────────────────────────────────────────────────
    await client.query(`
        INSERT INTO plans (id, name, price_monthly, features, limits) VALUES
        ('starter', 'Starter', 0, '{"emailNotifications":true,"adminDashboard":true,"designInquiries":false,"dhlShipping":false,"customBranding":false}', '{"bookings_per_month":50,"users":1}'),
        ('pro', 'Pro', 4900, '{"emailNotifications":true,"adminDashboard":true,"designInquiries":true,"dhlShipping":true,"customBranding":true}', '{"bookings_per_month":500,"users":5}'),
        ('enterprise', 'Enterprise', 19900, '{"emailNotifications":true,"adminDashboard":true,"designInquiries":true,"dhlShipping":true,"customBranding":true,"dedicatedSupport":true,"apiAccess":true}', '{"bookings_per_month":-1,"users":-1}')
        ON CONFLICT (id) DO NOTHING
    `);
}

module.exports = { query, initDatabase, getPool };
