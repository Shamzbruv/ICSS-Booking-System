const express = require('express');
const { query } = require('../../db/connection');
const { authenticate, requireTenantOwnership } = require('../../middleware/auth');
const { logAudit } = require('../../services/audit');

const platformRouter = express.Router();
const tenantRouter = express.Router();
const UUID = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
const validId = id => typeof id === 'string' && UUID.test(id);

function privateResponse(_req, res, next) {
    res.set('Cache-Control', 'private, no-store');
    next();
}

platformRouter.use(privateResponse);
platformRouter.get('/', async (_req, res) => {
    const { rows } = await query(`
        SELECT announcement.id, announcement.title, announcement.body, announcement.published_at, announcement.withdrawn_at,
            publisher.name AS author_name
        FROM platform_announcements AS announcement LEFT JOIN users AS publisher ON publisher.id=announcement.author_user_id
        ORDER BY announcement.published_at DESC, announcement.id DESC LIMIT 50`);
    res.json({ announcements: rows });
});

platformRouter.post('/', async (req, res) => {
    const { requestId, title, body } = req.body || {};
    if (!validId(requestId) || typeof title !== 'string' || !title.trim() || title.trim().length > 100 ||
        typeof body !== 'string' || !body.trim() || body.trim().length > 2000) {
        return res.status(400).json({ error: 'Enter a title of up to 100 characters and a message of up to 2,000 characters.' });
    }
    const { rows: [published] } = await query(`
        INSERT INTO platform_announcements (id, author_user_id, title, body)
        VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING RETURNING id,published_at`,
    [requestId, req.user.id, title.trim(), body.trim()]);
    if (published) {
        await logAudit({ action:'announcement.published', userId:req.user.id, entity:'platform_announcement', entityId:published.id });
        return res.status(201).json(published);
    }
    const { rows: [existing] } = await query(`
        SELECT id,published_at FROM platform_announcements
        WHERE id=$1 AND author_user_id=$2 AND title=$3 AND body=$4`, [requestId, req.user.id, title.trim(), body.trim()]);
    if (!existing) return res.status(409).json({ error:'This announcement reference was already used. Start a new announcement.' });
    return res.json(existing);
});

platformRouter.post('/:id/withdraw', async (req, res) => {
    if (!validId(req.params.id)) return res.status(400).json({ error:'Invalid announcement.' });
    const { rows: [withdrawn] } = await query(`
        UPDATE platform_announcements SET withdrawn_at=NOW()
        WHERE id=$1 AND withdrawn_at IS NULL RETURNING id`, [req.params.id]);
    if (withdrawn) await logAudit({ action:'announcement.withdrawn', userId:req.user.id, entity:'platform_announcement', entityId:withdrawn.id });
    return res.json({ success:true });
});

tenantRouter.use(privateResponse, authenticate, requireTenantOwnership('tenant_admin','staff'));

tenantRouter.get('/', async (req, res) => {
    // A support preview can see platform updates, but never the tenant's read state.
    const userId = req.impersonation ? null : req.user.id;
    const { rows } = await query(`
        SELECT announcement.id, announcement.title, announcement.body, announcement.published_at,
            dismissal.dismissed_at,
            COUNT(*) FILTER (WHERE dismissal.dismissed_at IS NULL) OVER ()::int AS unread
        FROM platform_announcements AS announcement
        LEFT JOIN platform_announcement_dismissals AS dismissal ON dismissal.announcement_id=announcement.id
            AND dismissal.tenant_id=$1 AND dismissal.user_id=$2
        WHERE announcement.withdrawn_at IS NULL
        ORDER BY (dismissal.dismissed_at IS NULL) DESC, announcement.published_at DESC, announcement.id DESC LIMIT 25`,
    [req.tenant.id, userId]);
    const announcements = rows.map(({ unread: _unread, ...item }) => item);
    res.json({ announcement: announcements.find(item => !item.dismissed_at) || null, announcements, unread: rows[0]?.unread || 0 });
});

tenantRouter.use((req, res, next) => {
    if (req.impersonation) return res.status(403).json({ error:'Only tenant users can change their announcement read status.' });
    next();
});

tenantRouter.post('/dismiss-all', async (req, res) => {
    await query(`
        INSERT INTO platform_announcement_dismissals (announcement_id, tenant_id, user_id)
        SELECT id,$1,$2 FROM platform_announcements WHERE withdrawn_at IS NULL
        ON CONFLICT DO NOTHING`, [req.tenant.id, req.user.id]);
    res.json({ success:true });
});

tenantRouter.post('/:id/dismiss', async (req, res) => {
    if (!validId(req.params.id)) return res.status(400).json({ error:'Invalid announcement.' });
    await query(`
        INSERT INTO platform_announcement_dismissals (announcement_id, tenant_id, user_id)
        SELECT id,$2,$3 FROM platform_announcements WHERE id=$1
        ON CONFLICT DO NOTHING`, [req.params.id, req.tenant.id, req.user.id]);
    res.json({ success:true });
});

module.exports = { platformRouter, tenantRouter };
