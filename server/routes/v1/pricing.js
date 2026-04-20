/**
 * Pricing Routes — /api/v1/pricing
 * Server-side authoritative price calculation.
 * Used by the custom order flow (suits, garments, etc.)
 */

const express     = require('express');
const router      = express.Router();
const PricingEngine = require('../../services/PricingEngine');

// GET /api/v1/pricing/config — Return tenant pricing config (for UI)
router.get('/config', (req, res) => {
    const engine = new PricingEngine(req.tenant);
    res.json({
        config:  engine.getConfig(),
        styles:  engine.getStyles(),
        fabrics: engine.getFabricGrades()
    });
});

// POST /api/v1/pricing/calculate — Authoritative server-side price calculation
router.post('/calculate', (req, res) => {
    const { selection, region } = req.body;

    if (!selection) {
        return res.status(400).json({ error: 'selection object is required.' });
    }

    try {
        const result = PricingEngine.calculate(selection, region || 'local', req.tenant);
        res.json({ pricing: result });
    } catch (err) {
        console.error('[Pricing/Calculate]', err.message);
        res.status(500).json({ error: 'Failed to calculate price.' });
    }
});

module.exports = router;
