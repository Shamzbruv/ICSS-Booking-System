const express = require('express');
const rateLimit = require('express-rate-limit');
const { query, transaction } = require('../../db/connection');
const { authenticate, requireTenantOwnership } = require('../../middleware/auth');
const { normalizeEmail, tenantReplyAddress } = require('../../services/tenantReplyEmail');
const { cleanDesign, cleanMessage, tenantBrand, renderNewsletter, text } = require('../../services/newsletterDesign');
const { requestSubscription, confirmSubscription, unsubscribe, queueCampaign, subscriptionPage } = require('../../services/newsletter');

const publicRouter = express.Router();
const adminRouter = express.Router();
const UUID = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
const subscribeLimiter = rateLimit({
    windowMs: 15 * 60_000, max: 12, standardHeaders: true, legacyHeaders: false,
    message: { error: 'Too many signup attempts. Try again later.' }
});

function privateResponse(_req,res,next) {
    res.set({ 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' });
    next();
}

publicRouter.use(privateResponse);
publicRouter.post('/subscribe', subscribeLimiter, async (req,res) => {
    const email = normalizeEmail(req.body?.email);
    const slug = text(req.body?.slug, 51);
    if (!email || req.body?.consent !== true || !/^[a-z\d-]{2,50}$/.test(slug)) {
        return res.status(400).json({ error: 'Enter a valid email and agree to receive updates.' });
    }
    const { rows: [tenant] } = await query(`
        SELECT tenants.name,tenants.id,tenants.slug,tenants.branding,tenants.site_config
        FROM tenants JOIN newsletter_settings AS settings ON settings.tenant_id=tenants.id
        WHERE tenants.slug=$1 AND tenants.active AND settings.enabled`, [slug]);
    if (!tenant) return res.status(404).json({ error: 'Newsletter signup is unavailable.' });
    try {
        await requestSubscription(query, tenant, email);
        return res.status(202).json({ message: 'Check your inbox for a confirmation link if you’re new to this newsletter.' });
    } catch (error) {
        console.error('[Newsletter/Confirmation]', error.code || error.name);
        return res.status(503).json({ error: 'We couldn’t send the confirmation email. Please try again later.' });
    }
});

publicRouter.get('/:action/:token', (req,res,next) => {
    const { action,token } = req.params;
    if (!['confirm','unsubscribe'].includes(action) || !UUID.test(token)) return next();
    const confirming = action === 'confirm';
    const title = confirming ? 'Confirm your newsletter subscription' : 'Unsubscribe from this newsletter';
    return res.type('html').send(subscriptionPage({
        title,
        message: confirming ? 'Confirm to start receiving updates from this business.' : 'Stop receiving newsletter updates from this business.',
        action: `/api/v1/newsletter/${action}/${token}`,
        label: confirming ? 'Confirm subscription' : 'Unsubscribe'
    }));
});

publicRouter.post('/confirm/:token', async (req,res,next) => {
    if (!UUID.test(req.params.token)) return next();
    const confirmed = await confirmSubscription(query, req.params.token);
    return res.status(confirmed ? 200 : 410).type('html').send(subscriptionPage(confirmed
        ? { title:'You’re subscribed', message:'Your subscription has been confirmed.' }
        : { title:'This link is no longer active', message:'Sign up again on the business website to request a new link.' }));
});

publicRouter.post('/unsubscribe/:token', async (req,res,next) => {
    if (!UUID.test(req.params.token)) return next();
    await unsubscribe(query, req.params.token);
    if (req.body?.['List-Unsubscribe'] === 'One-Click') return res.sendStatus(200);
    return res.type('html').send(subscriptionPage({
        title:'You’re unsubscribed', message:'You won’t receive any more newsletters from this business.'
    }));
});

adminRouter.use(privateResponse, authenticate, requireTenantOwnership('tenant_admin'));

adminRouter.get('/settings', async (req,res) => {
    const { rows: [settings] } = await query('SELECT enabled,design FROM newsletter_settings WHERE tenant_id=$1', [req.tenant.id]);
    res.json({ enabled: settings?.enabled ?? false, design: cleanDesign(settings?.design), brand: tenantBrand(req.tenant) });
});

adminRouter.put('/settings', async (req,res) => {
    if (typeof req.body?.enabled !== 'boolean') return res.status(400).json({ error:'Enter a signup preference.' });
    const design = cleanDesign(req.body?.design || {});
    await query(`INSERT INTO newsletter_settings (tenant_id,enabled,design) VALUES ($1,$2,$3)
                 ON CONFLICT (tenant_id) DO UPDATE SET enabled=EXCLUDED.enabled,design=EXCLUDED.design`,
    [req.tenant.id, req.body.enabled, JSON.stringify(design)]);
    return res.json({ enabled:req.body.enabled, design });
});

adminRouter.get('/subscribers', async (req,res) => {
    const search = text(req.query.search, 120);
    const page = Math.max(1, Math.min(100_000, Number.parseInt(req.query.page,10) || 1));
    const status = ['pending','subscribed','unsubscribed'].includes(req.query.status) ? req.query.status : '';
    const [{ rows }, { rows: [totals] }] = await Promise.all([
        query(`SELECT id,email,status,requested_at,subscribed_at,unsubscribed_at
            FROM newsletter_subscribers WHERE tenant_id=$1 AND ($2='' OR STRPOS(email,LOWER($2))>0)
                AND ($3='' OR status=$3) ORDER BY requested_at DESC,id LIMIT 26 OFFSET $4`,
        [req.tenant.id, search, status, (page-1)*25]),
        query(`SELECT COUNT(*) FILTER (WHERE status='subscribed')::int AS subscribed,
              COUNT(*) FILTER (WHERE status='pending')::int AS pending,
              COUNT(*) FILTER (WHERE status='unsubscribed')::int AS unsubscribed
              FROM newsletter_subscribers WHERE tenant_id=$1`, [req.tenant.id])
    ]);
    res.json({ subscribers:rows.slice(0,25), more:rows.length>25, totals });
});

adminRouter.post('/preview', (req,res) => {
    const message = cleanMessage(req.body?.message || {});
    const brand = tenantBrand(req.tenant);
    const content = renderNewsletter({ brand, message, design: cleanDesign(req.body?.design || {}), unsubscribe: brand.url });
    res.json({ html:content.html });
});

adminRouter.post('/campaigns', async (req,res) => {
    const { requestId, audience, subscriberId } = req.body || {};
    if (!UUID.test(requestId || '') || !['all','individual'].includes(audience) || (audience === 'individual' && !UUID.test(subscriberId || ''))) {
        return res.status(400).json({ error:'Select a valid audience and try again.' });
    }
    const message = cleanMessage(req.body.message || {});
    if (!message.subject || !message.body) return res.status(400).json({ error:'Enter a subject and message.' });
    if (!process.env.RESEND_API_KEY) return res.status(503).json({ error:'Newsletter email delivery is unavailable.' });
    const brand = { ...tenantBrand(req.tenant), replyTo:await tenantReplyAddress(query, req.tenant.id) };
    const content = { brand, design:cleanDesign(req.body.design || {}), message };
    const campaign = await transaction(client => queueCampaign(client, req.tenant.id, requestId, audience === 'individual' ? subscriberId : null, content));
    return res.status(202).json(campaign);
});

adminRouter.get('/campaigns', async (req,res) => {
    const { rows } = await query(`
        SELECT campaign.id,campaign.subject,campaign.created_at,counts.*
        FROM (SELECT id,subject,created_at FROM newsletter_campaigns WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 30) AS campaign
        CROSS JOIN LATERAL (SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE status IN ('queued','sending'))::int AS queued,
            COUNT(*) FILTER (WHERE status='sent')::int AS sent,
            COUNT(*) FILTER (WHERE status='failed')::int AS failed,
            COUNT(*) FILTER (WHERE status='skipped')::int AS skipped
            FROM newsletter_deliveries WHERE campaign_id=campaign.id AND tenant_id=$1) AS counts
        ORDER BY campaign.created_at DESC`, [req.tenant.id]);
    res.json({ campaigns:rows });
});

function newsletterError(error,_req,res,_next) {
    if (!error.status || error.status >= 500) console.error('[Newsletter/API]', error.code || error.name);
    res.status(error.status || 500).json({ error:error.status && error.status < 500 ? error.message : 'Newsletter request failed. Please try again.' });
}
publicRouter.use(newsletterError);
adminRouter.use(newsletterError);

module.exports = { publicRouter, adminRouter };
