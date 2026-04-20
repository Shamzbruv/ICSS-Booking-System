/**
 * Auth Routes — /api/v1/auth
 * Login, Register, and Token Refresh
 */

const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const { query }      = require('../../db/connection');
const { signToken, authenticate } = require('../../middleware/auth');
const { authLimiter } = require('../../middleware/rateLimiter');

// POST /api/v1/auth/register
// Register a new user under a specific tenant
router.post('/register', authLimiter, async (req, res) => {
    const { email, password, name, tenantSlug } = req.body;

    if (!email || !password || !tenantSlug) {
        return res.status(400).json({ error: 'email, password, and tenantSlug are required.' });
    }

    if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    try {
        // Resolve tenant
        const tenantResult = await query(
            `SELECT id FROM tenants WHERE slug = $1 AND active = true`, [tenantSlug]
        );
        if (tenantResult.rows.length === 0) {
            return res.status(404).json({ error: 'Tenant not found.' });
        }
        const tenantId = tenantResult.rows[0].id;

        const passwordHash = await bcrypt.hash(password, 12);

        const result = await query(
            `INSERT INTO users (tenant_id, email, password_hash, name, role)
             VALUES ($1, $2, $3, $4, 'customer')
             RETURNING id, email, name, role, tenant_id`,
            [tenantId, email.toLowerCase().trim(), passwordHash, name || '']
        );

        const user = result.rows[0];
        const token = signToken({
            id:        user.id,
            email:     user.email,
            role:      user.role,
            tenant_id: user.tenant_id
        });

        res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });

    } catch (err) {
        if (err.code === '23505') { // Unique violation
            return res.status(409).json({ error: 'An account with this email already exists.' });
        }
        console.error('[Auth/Register]', err.message);
        res.status(500).json({ error: 'Registration failed. Please try again.' });
    }
});

// POST /api/v1/auth/login
router.post('/login', authLimiter, async (req, res) => {
    const { email, password, tenantSlug } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'email and password are required.' });
    }

    try {
        let tenantFilter = '';
        let params = [email.toLowerCase().trim()];

        if (tenantSlug) {
            const tenantResult = await query(
                `SELECT id FROM tenants WHERE slug = $1 AND active = true`, [tenantSlug]
            );
            if (tenantResult.rows.length === 0) {
                return res.status(401).json({ error: 'Invalid credentials.' });
            }
            tenantFilter = ` AND u.tenant_id = $2`;
            params.push(tenantResult.rows[0].id);
        }

        const result = await query(
            `SELECT u.id, u.email, u.name, u.role, u.password_hash, u.tenant_id, t.slug AS tenant_slug
             FROM users u
             JOIN tenants t ON t.id = u.tenant_id
             WHERE u.email = $1 AND u.active = true${tenantFilter}`,
            params
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const user = result.rows[0];
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid email or password.' });
        }

        const token = signToken({
            id:          user.id,
            email:       user.email,
            role:        user.role,
            tenant_id:   user.tenant_id,
            tenant_slug: user.tenant_slug
        });

        res.json({
            token,
            user: {
                id:          user.id,
                email:       user.email,
                name:        user.name,
                role:        user.role,
                tenant_slug: user.tenant_slug
            }
        });

    } catch (err) {
        console.error('[Auth/Login]', err.message);
        res.status(500).json({ error: 'Login failed. Please try again.' });
    }
});

// GET /api/v1/auth/me — Get current user profile
router.get('/me', authenticate, async (req, res) => {
    try {
        const result = await query(
            `SELECT u.id, u.email, u.name, u.role, u.created_at, t.name AS tenant_name, t.slug AS tenant_slug, t.plan_id
             FROM users u
             JOIN tenants t ON t.id = u.tenant_id
             WHERE u.id = $1`,
            [req.user.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
        res.json({ user: result.rows[0] });
    } catch (err) {
        console.error('[Auth/Me]', err.message);
        res.status(500).json({ error: 'Failed to fetch profile.' });
    }
});

module.exports = router;
