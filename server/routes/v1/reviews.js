const express = require('express');
const { query, transaction } = require('../../db/connection');
const { verifyReviewToken, reviewerName } = require('../../services/bookingReviews');
const router = express.Router();

router.get('/', async (req, res) => {
    const limit = Math.min(20, Math.max(1, Number.parseInt(req.query.limit, 10) || 3));
    const before = req.query.before;
    if (before && !/^\d{1,18}$/.test(before)) return res.status(400).json({ error: 'Invalid review page.' });
    try {
        const [summary, reviews] = await Promise.all([
            query(`SELECT COUNT(*)::int AS count,COALESCE(ROUND(AVG(rating)::numeric,1),0) AS average FROM booking_reviews WHERE tenant_id=$1`, [req.tenant.id]),
            query(`SELECT id,display_name,rating,comment,created_at FROM booking_reviews WHERE tenant_id=$1 AND ($2::bigint IS NULL OR id<$2) ORDER BY id DESC LIMIT $3`, [req.tenant.id, before || null, limit + 1])
        ]);
        const rows = reviews.rows.slice(0, limit).map(({ id, display_name, rating, comment, created_at }) => ({ id, display_name, rating, comment, created_at }));
        res.set('Cache-Control', 'no-store').json({ summary: { count: Number(summary.rows[0].count), average: Number(summary.rows[0].average) }, reviews: rows, nextCursor: reviews.rows.length > limit ? String(rows[rows.length - 1].id) : null });
    } catch (err) { console.error('[Reviews/List]', err.message); res.status(500).json({ error: 'Reviews could not be loaded. Please try again.' }); }
});

router.post('/', async (req, res) => {
    const { token, rating, comment, publishConsent } = req.body || {};
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || typeof comment !== 'string' || !comment.trim() || comment.length > 1200 || publishConsent !== true) return res.status(400).json({ error: 'Choose 1–5 stars, write a review (up to 1,200 characters), and agree to publish it.' });
    let bookingId;
    try { bookingId = verifyReviewToken(token, req.tenant.id); }
    catch { return res.status(401).json({ error: 'Use the private review link in your appointment-completed email. The link may have expired.' }); }
    try {
        const review = await transaction(async client => {
            const result = await client.query(`SELECT id,name,status FROM bookings WHERE id=$1 AND tenant_id=$2 FOR UPDATE`, [bookingId, req.tenant.id]);
            const booking = result.rows[0];
            if (!booking || booking.status !== 'completed') { const err = new Error('Reviews are available after the business marks your appointment completed.'); err.status = 403; throw err; }
            const saved = await client.query(`INSERT INTO booking_reviews (tenant_id,booking_id,display_name,rating,comment)
                VALUES ($1,$2,$3,$4,$5) ON CONFLICT (booking_id) DO UPDATE SET rating=EXCLUDED.rating,comment=EXCLUDED.comment,updated_at=NOW()
                RETURNING id,display_name,rating,comment,created_at`, [req.tenant.id, bookingId, reviewerName(booking.name), rating, comment.trim().replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')]);
            return saved.rows[0];
        });
        res.status(201).json({ success: true, review });
    } catch (err) { if (err.status) return res.status(err.status).json({ error: err.message }); console.error('[Reviews/Save]', err.message); res.status(500).json({ error: 'Your review could not be saved. Please try again.' }); }
});
module.exports = router;
