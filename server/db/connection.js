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

    // ── Themes (Industry Starter Kits) ─────────────────────────────────────────
    await client.query(`
        CREATE TABLE IF NOT EXISTS themes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            preview_image_url TEXT,
            template_path TEXT,
            visual_config JSONB DEFAULT '{}',
            business_config JSONB DEFAULT '{}',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(name)
        )
    `);

    // ── Tenants ───────────────────────────────────────────────────────────────
    await client.query(`
        CREATE TABLE IF NOT EXISTS tenants (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            slug TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            theme_id UUID REFERENCES themes(id) ON DELETE SET NULL,
            plan_id TEXT REFERENCES plans(id) DEFAULT 'starter',
            features JSONB DEFAULT '{}',
            limits JSONB DEFAULT '{}',
            branding JSONB DEFAULT '{}',
            active BOOLEAN DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);

    // ── Tenant Slug History (for redirects) ──────────────────────────────────
    await client.query(`
        CREATE TABLE IF NOT EXISTS tenant_slug_history (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
            old_slug TEXT UNIQUE NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);

    // ── Pending Signups & Provisioning Jobs ───────────────────────────────────
    await client.query(`
        CREATE TABLE IF NOT EXISTS pending_signups (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            signup_token TEXT UNIQUE NOT NULL,
            tenant_name TEXT NOT NULL,
            tenant_slug TEXT NOT NULL,
            admin_email TEXT NOT NULL,
            admin_password_hash TEXT NOT NULL,
            theme_id UUID REFERENCES themes(id),
            plan_id TEXT,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
        )
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS provisioning_jobs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            status TEXT DEFAULT 'pending',
            tenant_slug TEXT NOT NULL,
            signup_token TEXT,
            webhook_id TEXT,
            payload JSONB DEFAULT '{}',
            error_message TEXT,
            attempts INTEGER DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
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
            provider TEXT,
            provider_user_id TEXT,
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
            calendar_event_id TEXT,
            sync_status TEXT DEFAULT 'pending',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(tenant_id, booking_date, booking_time)
        )
    `);

    // Ensure columns exist if table was already created
    try { await client.query(`ALTER TABLE pending_signups ALTER COLUMN tenant_slug DROP NOT NULL`); } catch(e){}
    try { await client.query(`ALTER TABLE provisioning_jobs ALTER COLUMN tenant_slug DROP NOT NULL`); } catch(e){}
    try { await client.query(`ALTER TABLE tenants ADD COLUMN subscription_status TEXT DEFAULT 'trial'`); } catch(e){}
    try { await client.query(`ALTER TABLE tenants ADD COLUMN stripe_customer_id TEXT`); } catch(e){}
    try { await client.query(`ALTER TABLE tenants ADD COLUMN stripe_subscription_id TEXT`); } catch(e){}
    try { await client.query(`ALTER TABLE tenants ADD COLUMN theme_id UUID REFERENCES themes(id) ON DELETE SET NULL`); } catch(e){}
    try { await client.query(`ALTER TABLE tenants ADD COLUMN paypal_subscription_id TEXT`); } catch(e){}
    try { await client.query(`ALTER TABLE tenants ADD COLUMN paypal_plan_id TEXT`); } catch(e){}
    try { await client.query(`ALTER TABLE tenants ADD COLUMN feed_token UUID DEFAULT gen_random_uuid()`); } catch(e){}
    try { await client.query(`ALTER TABLE users ADD COLUMN provider TEXT`); } catch(e){}
    try { await client.query(`ALTER TABLE users ADD COLUMN provider_user_id TEXT`); } catch(e){}
    try { await client.query(`ALTER TABLE users ADD COLUMN feed_token UUID DEFAULT gen_random_uuid()`); } catch(e){}
    try { await client.query(`ALTER TABLE bookings ADD COLUMN calendar_event_id TEXT`); } catch(e){}
    try { await client.query(`ALTER TABLE bookings ADD COLUMN sync_status TEXT DEFAULT 'pending'`); } catch(e){}
    try { await client.query(`ALTER TABLE bookings ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW()`); } catch(e){}

    // Indexes for fast tenant-scoped lookups
    await client.query(`CREATE INDEX IF NOT EXISTS idx_bookings_tenant_date ON bookings(tenant_id, booking_date)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_bookings_tenant_email ON bookings(tenant_id, email)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_bookings_sync_status ON bookings(tenant_id, sync_status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_bookings_calendar_event ON bookings(calendar_event_id)`);

    // ── Calendar Connections ──────────────────────────────────────────────────
    await client.query(`
        CREATE TABLE IF NOT EXISTS calendar_connections (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            provider TEXT NOT NULL,
            provider_account_id TEXT NOT NULL,
            encrypted_access_token TEXT NOT NULL,
            encrypted_refresh_token TEXT,
            token_expires_at TIMESTAMPTZ,
            sync_channel_id TEXT,
            sync_resource_id TEXT,
            sync_expires_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE(tenant_id, provider)
        )
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_calendar_conn_tenant ON calendar_connections(tenant_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_calendar_conn_webhook ON calendar_connections(sync_channel_id)`);

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

    // ── Custom Theme Requests ─────────────────────────────────────────────────
    await client.query(`
        CREATE TABLE IF NOT EXISTS custom_theme_requests (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
            status TEXT DEFAULT 'pending',
            deposit_required BOOLEAN DEFAULT true,
            deposit_paid BOOLEAN DEFAULT false,
            quoted_price NUMERIC,
            final_price NUMERIC,
            approved_scope TEXT,
            notes TEXT,
            assigned_developer TEXT,
            delivery_status TEXT DEFAULT 'not_started',
            payment_state TEXT DEFAULT 'unpaid',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
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

    // ── Seed Themes ───────────────────────────────────────────────────────────
    await client.query(`
        INSERT INTO themes (name, category, template_path, business_config) VALUES
        ('Lumina Lens', 'Photography', '/Template/deepseek_html_20260421_3e8960.html', '{"services": [{"name": "1-Hour Portrait Session", "duration_minutes": 60, "price": 15000}]}'::jsonb),
        ('Elegant Nails', 'Nail Tech', '/Template/deepseek_html_20260421_6c135e.html', '{"services": [{"name": "Acrylic Full Set", "duration_minutes": 90, "price": 8000}]}'::jsonb),
        ('Classic Cuts', 'Barber', '/Template/deepseek_html_20260421_6c135e.html', '{"services": [{"name": "Men''s Haircut & Beard", "duration_minutes": 45, "price": 3500}]}'::jsonb),
        ('Pro Auto Care', 'Mechanic', '/Template/deepseek_html_20260421_3e8960.html', '{"services": [{"name": "Oil Change & Inspection", "duration_minutes": 45, "price": 12000}]}'::jsonb),
        ('Gather & Grace', 'Events', '/Template/deepseek_html_20260421_e879f5.html', '{"services": [{"name": "Event Venue Tour", "duration_minutes": 30, "price": 0}]}'::jsonb),
        ('Zen Spa', 'Spa/Wellness', '/Template/deepseek_html_20260421_6775b1.html', '{"services": [{"name": "Swedish Massage (60 Min)", "duration_minutes": 60, "price": 10000}]}'::jsonb),
        ('Legal Access', 'Legal', '/Template/deepseek_html_20260421_7b8f29.html', '{"services": [{"name": "Initial Consultation", "duration_minutes": 30, "price": 5000}]}'::jsonb),
        ('Iron Fitness', 'Fitness', '/Template/deepseek_html_20260421_77f091.html', '{"services": [{"name": "Personal Training Session", "duration_minutes": 60, "price": 6000}]}'::jsonb),
        ('Wellness Clinic', 'Medical', '/Template/deepseek_html_20260421_e9afd1.html', '{"services": [{"name": "General Checkup", "duration_minutes": 30, "price": 7500}]}'::jsonb)
        ON CONFLICT (name) DO NOTHING
    `);
}

module.exports = { query, initDatabase, getPool };
