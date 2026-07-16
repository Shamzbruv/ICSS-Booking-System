const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { query, transaction } = require('../../db/connection');
const { authenticate, requirePlatformOwner } = require('../../middleware/auth');
const { generateAgreementPdf } = require('../../services/partnerAgreement');
const { sendPartnerAgreementEmail } = require('../../services/email');

const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');
const baseUrl = req => String(process.env.BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
const clean = (value, max = 500) => String(value || '').trim().slice(0, max);
const isOwner = req => req.user?.role === 'platform_owner';
const requireActualOwner = (req, res, next) => isOwner(req) ? next() : res.status(403).json({ error:'Only the Platform Owner can manage and countersign agreements.' });

router.post('/invitations', authenticate, requirePlatformOwner, requireActualOwner, async (req, res) => {
    const email = clean(req.body.email, 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'A valid partner email is required.' });
    try {
        const token = crypto.randomBytes(32).toString('base64url');
        const result = await query(`INSERT INTO partner_agreements (partner_email, partner_name, signing_token_hash, signing_token_expires_at)
            VALUES ($1,$2,$3,NOW() + INTERVAL '7 days') RETURNING *`, [email, clean(req.body.name, 200) || null, hashToken(token)]);
        const link = `${baseUrl(req)}/partner-contract.html?token=${encodeURIComponent(token)}`;
        await sendPartnerAgreementEmail({ to: email, subject: 'Your ICSS Marketing Partner Agreement', message: 'You have been invited to review and sign the ICSS Marketing and Revenue Share Agreement. This private link can be used once and expires in 7 days.', link });
        res.status(201).json({ agreement: result.rows[0], signingLink: link });
    } catch (err) { console.error('[Partners/Invite]', err); res.status(500).json({ error: 'Could not create the invitation.' }); }
});

router.get('/sign/:token', async (req, res) => {
    const result = await query(`SELECT id, partner_email, partner_name, status, signing_token_expires_at FROM partner_agreements WHERE signing_token_hash=$1`, [hashToken(req.params.token)]);
    if (!result.rows.length) return res.status(404).json({ error: 'This signing link is invalid or has already been used.' });
    const a = result.rows[0];
    if (new Date(a.signing_token_expires_at) < new Date()) return res.status(410).json({ error: 'This signing link has expired. Ask the Owner for a new link.' });
    res.json({ agreement: a, ownerFields: ['Effective date', 'Owner signature', 'Owner printed name', 'Title / capacity', 'Owner date', 'Owner witness signature and name'] });
});

router.get('/sign/:token/document', async (req, res) => {
    const result = await query(`SELECT * FROM partner_agreements WHERE signing_token_hash=$1 AND signing_token_expires_at>NOW()`, [hashToken(req.params.token)]);
    if (!result.rows.length) return res.status(404).json({ error:'This signing link is invalid, expired, or has already been used.' });
    const pdf = await generateAgreementPdf(result.rows[0]);
    res.set({ 'Content-Type':'application/pdf', 'Content-Disposition':'inline; filename="ICSS_Agreement_Review.pdf"', 'Cache-Control':'private, no-store' }).send(pdf);
});

router.post('/sign/:token', async (req, res) => {
    const name = clean(req.body.partnerName, 200), address = clean(req.body.partnerAddress, 500), platforms = clean(req.body.approvedSocialPlatforms, 500);
    const signature = clean(req.body.signature, 200), title = clean(req.body.title, 150), witnessName = clean(req.body.witnessName, 200), witnessSignature = clean(req.body.witnessSignature, 200);
    if (![name, address, platforms, signature, title, witnessName, witnessSignature].every(Boolean) || req.body.accepted !== true) return res.status(400).json({ error: 'Complete all highlighted and signature fields, and accept the agreement.' });
    try {
        const result = await query(`UPDATE partner_agreements SET partner_name=$1, partner_address=$2, approved_social_platforms=$3,
            partner_signature=$4, partner_title=$5, partner_witness_name=$6, partner_witness_signature=$7, partner_signed_at=NOW(),
            partner_signing_ip=$8, partner_signing_user_agent=$9, status='partner_signed', signing_token_hash=NULL, updated_at=NOW()
            WHERE signing_token_hash=$10 AND signing_token_expires_at>NOW() RETURNING *`,
            [name,address,platforms,signature,title,witnessName,witnessSignature,req.ip,clean(req.get('user-agent'),500),hashToken(req.params.token)]);
        if (!result.rows.length) return res.status(410).json({ error: 'This link has expired or was already used.' });
        const pdf = await generateAgreementPdf(result.rows[0]);
        await sendPartnerAgreementEmail({ to: result.rows[0].partner_email, subject: 'Your signed ICSS agreement — Owner signature pending', message: 'Your signature has been recorded. Your partner-signed copy is attached. The Owner will submit their copy next, and you will automatically receive the fully signed agreement as well.', pdfBuffer: pdf });
        const ownerEmail = process.env.CONTRACT_OWNER_EMAIL || 'Shamzbiz1@gmail.com';
        await sendPartnerAgreementEmail({ to: ownerEmail, subject: `Agreement ready for Owner signature — ${name}`, message: `${name} has signed the agreement. Sign in to the ICSS developer platform and open Contracts to review their copy, complete the Owner fields, and send the final copy.` });
        res.json({ message: 'Your signature was recorded and your copy was emailed to you.' });
    } catch (err) { console.error('[Partners/Sign]', err); res.status(500).json({ error: 'Could not record the signature.' }); }
});

router.get('/', authenticate, async (req, res) => {
    if (!isOwner(req) && req.user.role !== 'platform_partner') return res.status(403).json({ error: 'Partner contract access required.' });
    const result = isOwner(req)
        ? await query(`SELECT id,partner_email,partner_name,status,access_role,signing_token_expires_at,partner_signed_at,owner_signed_at,effective_date,created_at FROM partner_agreements ORDER BY created_at DESC`)
        : await query(`SELECT id,partner_email,partner_name,status,access_role,signing_token_expires_at,partner_signed_at,owner_signed_at,effective_date,created_at FROM partner_agreements WHERE partner_user_id=$1 ORDER BY created_at DESC`, [req.user.id]);
    res.json({ agreements: result.rows });
});

router.post('/:id/owner-sign', authenticate, requirePlatformOwner, requireActualOwner, async (req, res) => {
    const fields = ['effectiveDate','signature','printedName','title','witnessName','witnessSignature'];
    if (!fields.every(key => clean(req.body[key], 200))) return res.status(400).json({ error: 'Complete all Owner and Owner witness fields.' });
    try {
        let temporaryPassword = null;
        const completed = await transaction(async client => {
            const existing = await client.query(`SELECT * FROM partner_agreements WHERE id=$1 FOR UPDATE`, [req.params.id]);
            if (!existing.rows.length || existing.rows[0].status !== 'partner_signed') throw Object.assign(new Error('Agreement is not awaiting Owner signature.'), { status: 409 });
            const a = existing.rows[0];
            const accessRole = a.access_role === 'developer_admin' ? 'developer_admin' : 'platform_partner';
            if (accessRole === 'developer_admin' && !a.pending_password_hash) throw Object.assign(new Error('The pending developer credential is incomplete. Create a new invitation.'), { status:409 });
            if (accessRole === 'platform_partner') temporaryPassword = crypto.randomBytes(12).toString('base64url') + '!7a';
            const passwordHash = a.pending_password_hash || await bcrypt.hash(temporaryPassword, 12);
            const currentUser = await client.query(`SELECT id FROM users WHERE tenant_id IS NULL AND LOWER(email)=LOWER($1) ORDER BY created_at LIMIT 1`, [a.partner_email]);
            const userResult = currentUser.rows.length
                ? await client.query(`UPDATE users SET password_hash=$1,name=$2,role=$3,active=true WHERE id=$4 RETURNING id`, [passwordHash,a.partner_name,accessRole,currentUser.rows[0].id])
                : await client.query(`INSERT INTO users (email,password_hash,name,role,active) VALUES ($1,$2,$3,$4,true) RETURNING id`, [a.partner_email,passwordHash,a.partner_name,accessRole]);
            const updated = await client.query(`UPDATE partner_agreements SET effective_date=$1,owner_signature=$2,owner_printed_name=$3,owner_title=$4,
                owner_witness_name=$5,owner_witness_signature=$6,owner_signed_at=NOW(),owner_user_id=$7,partner_user_id=$8,status='completed',pending_password_hash=NULL,updated_at=NOW() WHERE id=$9 RETURNING *`,
                [req.body.effectiveDate,clean(req.body.signature),clean(req.body.printedName),clean(req.body.title),clean(req.body.witnessName),clean(req.body.witnessSignature),req.user.id,userResult.rows[0].id,req.params.id]);
            return updated.rows[0];
        });
        const pdf = await generateAgreementPdf(completed);
        const isDeveloper = completed.access_role === 'developer_admin';
        const loginUrl = isDeveloper ? `${baseUrl(req)}/platform` : `${baseUrl(req)}/admin/login.html`;
        const credentialNote = isDeveloper ? 'Use the temporary password supplied to you by the Owner.' : `Temporary password: ${temporaryPassword}\nPlease change this password using Forgot Password after signing in.`;
        await sendPartnerAgreementEmail({ to: completed.partner_email, subject: 'Your fully signed ICSS Agreement and admin access', message: `The Owner has completed the agreement. Your final copy is attached and remains available for download. Login: ${loginUrl}\nEmail: ${completed.partner_email}\n${credentialNote}`, pdfBuffer: pdf });
        res.json({ message: 'Agreement completed. Credentials and the final copy were emailed to the partner.' });
    } catch (err) { console.error('[Partners/OwnerSign]', err); res.status(err.status || 500).json({ error: err.message || 'Could not complete the agreement.' }); }
});

router.get('/template/download', authenticate, requirePlatformOwner, requireActualOwner, async (req, res) => {
    const pdf = await generateAgreementPdf({ id:'TEMPLATE-PREVIEW', partner_name:'Alex Morgan', partner_email:'alex@example.com', partner_address:'12 Hope Road, Kingston, Jamaica', approved_social_platforms:'Instagram, Facebook and TikTok' });
    res.set({ 'Content-Type':'application/pdf', 'Content-Disposition':'inline; filename="ICSS_Agreement_Template.pdf"', 'Cache-Control':'private, no-store' }).send(pdf);
});

router.get('/:id/download', authenticate, async (req, res) => {
    const result = isOwner(req) ? await query(`SELECT * FROM partner_agreements WHERE id=$1`, [req.params.id]) : await query(`SELECT * FROM partner_agreements WHERE id=$1 AND partner_user_id=$2`, [req.params.id, req.user.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Agreement not found.' });
    const pdf = await generateAgreementPdf(result.rows[0]);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="ICSS_Partner_Agreement_${req.params.id}.pdf"`, 'Cache-Control': 'private, no-store' }).send(pdf);
});

module.exports = router;
