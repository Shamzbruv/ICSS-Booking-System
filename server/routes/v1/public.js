/**
 * Public Routes — /api/v1/public
 * No authentication required. Tenant-aware.
 * Used by the customer-facing booking widget.
 */

const express = require('express');
const router  = express.Router();
const { query } = require('../../db/connection');

// GET /api/v1/public/tenant — Expose safe branding for the booking widget
router.get('/tenant', (req, res) => {
    const { id, name, slug, plan_id, branding } = req.tenant;

    const safeBranding = {
        businessName:   name,
        primaryColor:   branding?.primaryColor   || '#D4AF37',
        accentColor:    branding?.accentColor    || '#D4AF37',
        logoUrl:        branding?.logoUrl        || null,
        bookingTagline: branding?.bookingTagline || 'Book your appointment below',
        timezone:       branding?.timezone       || 'America/Jamaica'
    };

    res.json({ slug, plan: plan_id, branding: safeBranding, layout: req.tenant.layout });
});

// GET /api/v1/public/services — List tenant's active services
router.get('/services', async (req, res) => {
    try {
        const result = await query(
            `SELECT id, name, description, duration_minutes, price, currency
             FROM services
             WHERE tenant_id = $1 AND active = true
             ORDER BY sort_order ASC NULLS LAST, name ASC`,
            [req.tenant.id]
        );
        res.json({ services: result.rows });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch services.' });
    }
});

// POST /api/v1/public/designs — Submit a design inquiry (public)
router.post('/designs', async (req, res) => {
    const {
        customerName, customerEmail, customerPhone,
        designName, gender, fabric, targetDate,
        description, bookingDate, bookingTime,
        photoBase64, photoName
    } = req.body;

    if (!customerName || !customerEmail || !description) {
        return res.status(400).json({ error: 'customerName, customerEmail, and description are required.' });
    }

    try {
        await query(
            `INSERT INTO design_inquiries
             (tenant_id, customer_name, customer_email, customer_phone,
              design_name, gender, fabric, target_date, description,
              booking_date, booking_time, has_photo)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
            [
                req.tenant.id, customerName, customerEmail, customerPhone || '',
                designName || '', gender || '', fabric || '', targetDate || null,
                description.substring(0, 2000),
                bookingDate || null, bookingTime || null,
                Boolean(photoBase64)
            ]
        );

        // Fire email notification async
        const { sendDesignInquiryEmail } = require('../../services/email');
        sendDesignInquiryEmail({
            customerName, customerEmail, customerPhone,
            designName, gender, fabric, targetDate, description,
            photoBase64, photoName
        }, req.tenant).catch(console.error);

        res.status(201).json({ success: true });
    } catch (err) {
        console.error('[Public/Designs]', err.message);
        res.status(500).json({ error: 'Failed to submit inquiry.' });
    }
});

// GET /api/v1/public/provisioning-status/:signupToken
router.get('/provisioning-status/:signupToken', async (req, res) => {
    const { signupToken } = req.params;
    
    // Basic UUID format check
    if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(signupToken)) {
        return res.status(400).json({ error: 'Invalid token format.' });
    }

    try {
        const result = await query(`SELECT status, tenant_slug FROM pending_signups WHERE signup_token = $1`, [signupToken]);
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Provisioning session not found.' });
        }

        const signup = result.rows[0];
        
        // Map to minimal state
        let returnStatus = signup.status; // pending, provisioned, failed

        // Check if there's an active job to show 'processing'
        if (returnStatus === 'pending') {
             const jobRes = await query(`SELECT status FROM provisioning_jobs WHERE signup_token = $1 ORDER BY created_at DESC LIMIT 1`, [signupToken]);
             if (jobRes.rows.length > 0) {
                 const jobStatus = jobRes.rows[0].status;
                 if (jobStatus === 'pending') returnStatus = 'processing';
                 else if (jobStatus === 'failed') returnStatus = 'failed';
                 else if (jobStatus === 'completed') returnStatus = 'provisioned';
             }
        }

        res.json({
            status: returnStatus,
            // Only return slug if fully provisioned to prevent premature redirects
            tenant_slug: returnStatus === 'provisioned' ? signup.tenant_slug : null
        });
    } catch (err) {
        console.error('[Provisioning Status Error]', err.message);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

module.exports = router;
