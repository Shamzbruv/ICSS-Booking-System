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

module.exports = router;
