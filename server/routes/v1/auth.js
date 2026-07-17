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
const crypto = require('crypto');
const { sendPasswordResetEmail } = require('../../services/email');

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
    const { email, password, tenantSlug, rememberMe } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'email and password are required.' });
    }

    // Token lifespan: 30 days if "Keep me signed in", otherwise 7 days
    const tokenExpiry = rememberMe ? '30d' : '7d';

    try {
        // ── Platform-level login — no tenant association required ─────────────
        const ownerRes = await query(
            `SELECT id, email, name, role, password_hash FROM users
             WHERE email = $1 AND role IN ('platform_owner', 'developer_admin', 'platform_partner') AND active = true`,
            [email.toLowerCase().trim()]
        );

        if (ownerRes.rows.length > 0) {
            const owner = ownerRes.rows[0];
            const valid = await bcrypt.compare(password, owner.password_hash);
            if (!valid) return res.status(401).json({ error: 'Invalid email or password.' });

            const token = signToken({ id: owner.id, email: owner.email, role: owner.role }, tokenExpiry);
            return res.json({ token, user: { id: owner.id, email: owner.email, name: owner.name, role: owner.role } });
        }

        // ── Standard tenant-scoped login ──────────────────────────────────────
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

        // If multiple accounts share the same email across tenants, prompt for handle
        if (result.rows.length > 1) {
            return res.status(409).json({
                error: 'Multiple accounts found for this email. Please enter your Business Handle to continue.',
                requiresHandle: true
            });
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
        }, tokenExpiry);

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
             LEFT JOIN tenants t ON t.id = u.tenant_id
             WHERE u.id = $1`,
            [req.user.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
        res.json({ user: result.rows[0] });
    } catch (err) {
        console.error('[Auth/Me]', err.message);
        res.status(500).json({ error: 'Failed to fetch user profile.' });
    }
});

// POST /api/v1/auth/forgot-password
router.post('/forgot-password', authLimiter, async (req, res) => {
    const { email, tenant_slug } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    try {
        const userRes = await query(
            `SELECT u.id,u.role,u.tenant_id FROM users u LEFT JOIN tenants t ON t.id=u.tenant_id
             WHERE LOWER(u.email)=LOWER($1) AND (($2::text IS NOT NULL AND t.slug=$2) OR $2::text IS NULL)
             ORDER BY u.created_at`,
            [email.toLowerCase().trim(), tenant_slug ? String(tenant_slug).trim().toLowerCase() : null]
        );
        
        // We always return generic success message to prevent email enumeration
        if (userRes.rows.length === 1) {
            const user = userRes.rows[0];
            
            // Invalidate any older reset tokens for this user
            await query(`UPDATE password_reset_tokens SET used = true WHERE user_id = $1`, [user.id]);
            
            // Generate standard crypto token
            const rawToken = crypto.randomBytes(32).toString('hex');
            
            // Hash token with SHA-256 for secure storage
            const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
            
            // Store hashed token (expires in 1 hour)
            await query(
                `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
                 VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
                [user.id, tokenHash]
            );

            // Determine base URL safely
            const baseUrl = process.env.PUBLIC_APP_URL || process.env.BASE_URL || 'https://icssbookings.com';
            const resetUrl = `${baseUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(email.toLowerCase().trim())}`;

            // Send Email
            await sendPasswordResetEmail(email, resetUrl);

            // Audit log
            try {
                await query(
                    `INSERT INTO audit_log (actor_user_id, tenant_id, action, entity, metadata, ip_address)
                     VALUES ($1, $2, 'password_reset_requested', 'user', $3, $4)`,
                    [user.id, user.tenant_id || null, JSON.stringify({ email: email }), req.ip]
                );
            } catch (e) { console.error('[Auth/AuditLog]', e.message); }
        }

        res.json({ message: 'If an account exists with that email, a password reset link has been sent.' });
    } catch (err) {
        console.error('[Auth/ForgotPassword]', err.message);
        res.status(500).json({ error: 'Failed to process request.' });
    }
});

// POST /api/v1/auth/reset-password
router.post('/reset-password', authLimiter, async (req, res) => {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword) return res.status(400).json({ error: 'Missing required fields.' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

    try {
        // Hash incoming raw token for lookup
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        const tokenRes = await query(
            `SELECT prt.id,prt.user_id,u.tenant_id FROM password_reset_tokens prt JOIN users u ON u.id=prt.user_id
             WHERE prt.token_hash=$1 AND prt.used=false AND prt.expires_at>NOW() AND LOWER(u.email)=LOWER($2)`,
            [tokenHash,email.toLowerCase().trim()]
        );

        if (tokenRes.rows.length === 0) return res.status(400).json({ error: 'Invalid or expired token.' });
        const tokenId = tokenRes.rows[0].id;
        const user = { id:tokenRes.rows[0].user_id, tenant_id:tokenRes.rows[0].tenant_id };

        // Hash new password
        const passwordHash = await bcrypt.hash(newPassword, 12);

        // Update user
        await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [passwordHash, user.id]);

        // Invalidate the token
        await query(`UPDATE password_reset_tokens SET used = true WHERE id = $1`, [tokenId]);

        // End active impersonation sessions safely if user is platform owner
        try {
            await query(`UPDATE impersonation_sessions SET revoked_at = NOW() WHERE actor_user_id = $1 AND revoked_at IS NULL`, [user.id]);
        } catch (e) {}

        // Audit log
        try {
            await query(
                `INSERT INTO audit_log (actor_user_id, tenant_id, action, entity, metadata, ip_address)
                 VALUES ($1, $2, 'password_reset_completed', 'user', '{}', $3)`,
                [user.id, user.tenant_id || null, req.ip]
            );
        } catch (e) { console.error('[Auth/AuditLog]', e.message); }

        res.json({ success: true, message: 'Password has been successfully reset. You can now log in.' });
    } catch (err) {
        console.error('[Auth/ResetPassword]', err.message);
        res.status(500).json({ error: 'Failed to process request.' });
    }
});

module.exports = router;
