require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');

const { tenantResolver } = require('./middleware/tenantResolver');
const { rateLimiter } = require('./middleware/rateLimiter');
const { initDatabase } = require('./db/connection');

// ─── Route Modules ────────────────────────────────────────────────────────────
const authRoutes        = require('./routes/v1/auth');
const availabilityRoutes = require('./routes/v1/availability');
const bookingRoutes     = require('./routes/v1/bookings');
const orderRoutes       = require('./routes/v1/orders');
const paymentRoutes     = require('./routes/v1/payments');
const adminRoutes       = require('./routes/v1/admin');
const tenantRoutes      = require('./routes/v1/tenants');
const publicRoutes      = require('./routes/v1/public');
const pricingRoutes     = require('./routes/v1/pricing');
const calendarRoutes    = require('./routes/v1/calendar');
const themesRoutes      = require('./routes/v1/themes');
const servicesRoutes    = require('./routes/v1/services');
const platformRoutes    = require('./routes/v1/platform');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Security Headers ─────────────────────────────────────────────────────────
app.use(helmet({
    contentSecurityPolicy: false, // Relaxed for admin panel — tighten in production
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" } // Required for PayPal popup communication
}));

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? [/\.icssbookings\.com$/, /^https:\/\/(www\.)?icssbookings\.com$/]
        : '*',           // Open in dev
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID', 'X-Tenant-Slug', 'X-Platform-Admin-Key', 'X-Impersonation-Session'],
    credentials: true
}));

// ─── Body Parsing ─────────────────────────────────────────────────────────────
// Capture raw body for PayPal webhook signature verification (must come before express.json)
app.use('/api/v1/payments/paypal/webhook', express.raw({ type: 'application/json' }), (req, res, next) => {
    req.rawBody = req.body.toString('utf8');
    req.body = JSON.parse(req.rawBody);
    next();
});
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Rate Limiting ────────────────────────────────────────────────────────────
app.use('/api/', rateLimiter);

// ─── Tenant Resolution ───────────────────────────────────────────────────────
// Injects req.tenant on every /api/v1/ request
// Platform routes bypass tenant resolution — they operate cross-tenant
app.use('/api/v1', (req, res, next) => {
    if (req.path.startsWith('/platform')) return next();
    tenantResolver(req, res, next);
});

// ─── Static Files (Admin Dashboard + React Frontend) ───────────────────────
app.use('/admin', express.static(path.join(__dirname, '../admin')));
app.use('/Template', express.static(path.join(__dirname, '../Template')));

// Serve legacy public folder (landing page, images, etc.) FIRST
app.use('/', express.static(path.join(__dirname, '../public')));

// Serve the compiled React application (SPA)
const frontendDist = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDist));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/v1/auth',         authRoutes);
app.use('/api/v1/availability', availabilityRoutes);
app.use('/api/v1/bookings',     bookingRoutes);
app.use('/api/v1/orders',       orderRoutes);
app.use('/api/v1/payments',     paymentRoutes);
app.use('/api/v1/admin',        adminRoutes);
app.use('/api/v1/tenants',      tenantRoutes);
app.use('/api/v1/public',       publicRoutes);
app.use('/api/v1/pricing',      pricingRoutes);
app.use('/api/v1/calendar',     calendarRoutes);
app.use('/api/v1/themes',       themesRoutes);
app.use('/api/v1/services',     servicesRoutes);
app.use('/api/v1/platform',     platformRoutes);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'ICSS Booking System',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// ─── React SPA Fallback ───────────────────────────────────────────────────────
// Serve React SPA for app routes. Static public pages (/, /industries/*, /faq)
// are already handled above by express.static(public) — so exclude them here.
app.get(/^\/(?!api\/|admin\/|admin$|Template\/|health$|industries\/|industries$|faq|sitemap\.xml|robots\.txt|favicon|logo)/, (req, res) => {
    // Only send the SPA if the static middleware didn't match
    // (i.e. file doesn't exist in public/ — checked by trying the file first)
    const staticPublic = path.join(__dirname, '../public', req.path);
    const fs = require('fs');
    if (fs.existsSync(staticPublic) && fs.statSync(staticPublic).isFile()) {
        return res.sendFile(staticPublic);
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
});

// ─── 404 Handler (API only now) ──────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found', path: req.path });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('[ERROR]', err.message, err.stack);
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production'
            ? 'An internal server error occurred.'
            : err.message
    });
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
const { startCronJobs } = require('./services/cron');
const { initQueue } = require('./services/queue');

async function start() {
    try {
        await initDatabase();
        await initQueue();
        app.listen(PORT, () => {
            console.log(`\n🚀 ICSS Booking System running on port ${PORT}`);
            console.log(`   Health:  http://localhost:${PORT}/health`);
            console.log(`   Admin:   http://localhost:${PORT}/admin`);
            console.log(`   API:     http://localhost:${PORT}/api/v1/`);
            console.log(`   Mode:    ${process.env.NODE_ENV || 'development'}\n`);
            startCronJobs();
        });
    } catch (err) {
        console.error('❌ Failed to start server:', err.message);
        process.exit(1);
    }
}

start();
