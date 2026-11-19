const express = require('express');
const { query } = require('../../db/connection');
const { authenticate, requireTenantOwnership } = require('../../middleware/auth');
const { listClients, clientProfile } = require('../../services/clientDirectory');

const router = express.Router();
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const text = value => typeof value === 'string' ? value : '';
const page = value => Math.max(1, Math.min(1_000_000, Number.parseInt(text(value), 10) || 1));

router.use((_req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    next();
});
router.use(authenticate, requireTenantOwnership('staff', 'tenant_admin'));

router.get('/', async (req, res) => {
    try {
        res.json(await listClients(query, req.tenant.id, {
            search: text(req.query.search), filter: text(req.query.filter), sort: text(req.query.sort), page: page(req.query.page)
        }));
    } catch (err) {
        console.error('[Clients/List]', err.code || err.name);
        res.status(500).json({ error: 'The client directory could not be loaded.' });
    }
});

router.get('/:bookingId', async (req, res) => {
    if (!uuid.test(req.params.bookingId)) return res.status(400).json({ error: 'Invalid client reference.' });
    try {
        const profile = await clientProfile(query, req.tenant.id, req.params.bookingId, req.tenant.branding?.timezone, page(req.query.page));
        if (!profile) return res.status(404).json({ error: 'Client profile not found.' });
        res.json(profile);
    } catch (err) {
        console.error('[Clients/Profile]', err.code || err.name);
        res.status(500).json({ error: 'The client profile could not be loaded.' });
    }
});

module.exports = router;
