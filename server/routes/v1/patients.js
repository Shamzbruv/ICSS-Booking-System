const express = require('express');
const { createHmac, randomUUID } = require('node:crypto');
const { query, transaction } = require('../../db/connection');
const { authenticate, requireTenantOwnership } = require('../../middleware/auth');
const { encrypt, decrypt } = require('../../services/encryption');
const { normalizeEmail } = require('../../services/tenantReplyEmail');

const router = express.Router();
const uuid = /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i;
const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
const tidy = value => typeof value === 'string' ? value.trim() : '';
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };

function id(value) {
    if (typeof value !== 'string' || !uuid.test(value)) fail(400, 'Invalid record reference.');
    return value;
}

function blindKey(tenantId, value) {
    const normalized = value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ');
    return createHmac('sha256', key).update(`patient-lookup-v1:${tenantId}:${normalized}`).digest('hex');
}

function encode(tenantId, input) {
    const fields = ['name','preferredName','email','phone','birthDate','reference'];
    if (!input || typeof input !== 'object' || fields.some(field => input[field] !== undefined && typeof input[field] !== 'string')) {
        fail(400, 'Check the patient name, contact details and date of birth.');
    }
    const name = tidy(input.name);
    const preferredName = tidy(input.preferredName);
    const email = normalizeEmail(input.email);
    const phone = tidy(input.phone);
    const birthDate = tidy(input.birthDate);
    const reference = tidy(input.reference);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(birthDate) ? new Date(birthDate + 'T00:00:00Z') : null;
    if (!name || name.length > 120 || preferredName.length > 120 || phone.length > 40 || reference.length > 60 ||
        (tidy(input.email) && !email) || (birthDate && (!date || !Number.isFinite(date.getTime()) ||
            date.toISOString().slice(0,10) !== birthDate || date > new Date() || birthDate < '1800-01-01'))) {
        fail(400, 'Check the patient name, contact details and date of birth.');
    }
    return [encrypt(JSON.stringify({ name, preferredName, email, phone, birthDate, reference })),
        [...new Set([name, preferredName, email, reference].filter(Boolean).map(value => blindKey(tenantId, value)))]];
}

function decode(row, brief = false) {
    const profile = JSON.parse(decrypt(row.profile_ciphertext) || 'null');
    if (!profile) fail(500, 'The patient record could not be read.');
    return { id:row.id, archived:Boolean(row.archived_at), ...(brief
        ? { name:profile.name, preferredName:profile.preferredName, reference:profile.reference }
        : profile) };
}

function audit(client, req, event, patientId) {
    return client.query(`INSERT INTO audit_log(tenant_id,user_id,action,entity,entity_id)
        VALUES($1,$2,$3,'booking_patient',$4)`, [req.tenant.id,req.user.id,event,patientId]);
}

async function lockBooking(client, tenantId, bookingId) {
    const { rows } = await client.query('SELECT id FROM bookings WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [tenantId,bookingId]);
    if (!rows.length) fail(404, 'Booking not found.');
}

async function linkBooking(client, req, bookingId, patientId) {
    const tenantId = req.tenant.id;
    await lockBooking(client, tenantId, bookingId);
    const { rows: [patient] } = await client.query(
        'SELECT archived_at FROM booking_patients WHERE tenant_id=$1 AND id=$2 FOR SHARE', [tenantId,patientId]);
    if (!patient || patient.archived_at) fail(404, 'Active patient not found.');
    const { rows: [existing] } = await client.query(
        'SELECT patient_id FROM patient_booking_links WHERE tenant_id=$1 AND booking_id=$2', [tenantId,bookingId]);
    if (existing?.patient_id === patientId) return;
    if (existing) fail(409, 'Unlink the current patient before choosing another.');
    await client.query(
        'INSERT INTO patient_booking_links(tenant_id,booking_id,patient_id) VALUES($1,$2,$3)', [tenantId,bookingId,patientId]);
    await audit(client, req, 'patient.booking_linked', patientId);
}

router.use((_req,res,next) => {
    res.set({ 'Cache-Control':'private, no-store', 'Referrer-Policy':'no-referrer' });
    next();
});
router.use(authenticate, requireTenantOwnership('tenant_admin'));
router.use(async (req,res,next) => {
    if (req.impersonation || req.user.impersonation_session_id) return res.status(403).json({error:'Patient records require a direct practice administrator sign-in.'});
    const { rows } = await query("SELECT id FROM users WHERE id=$1 AND tenant_id=$2 AND active AND role='tenant_admin'", [req.user.id, req.tenant.id]);
    if (!rows.length) return res.status(403).json({error:'Patient records require an active practice administrator account.'});
    next();
});

// POST keeps names and email addresses out of URLs and access logs.
router.post('/search', async (req,res) => {
    const search = tidy(req.body?.search);
    if (search.length > 254) fail(400, 'Search text is too long.');
    const page = Math.max(1, Math.min(100000, Number.parseInt(req.body?.page,10) || 1));
    const { rows } = await query(`
        SELECT id,profile_ciphertext,archived_at FROM booking_patients
        WHERE tenant_id=$1 AND (archived_at IS NOT NULL)=$2
          AND ($3::text IS NULL OR lookup_keys @> ARRAY[$3]::text[])
        ORDER BY updated_at DESC,id DESC LIMIT 26 OFFSET $4`,
    [req.tenant.id, req.body?.archived === true, search ? blindKey(req.tenant.id,search) : null, (page-1)*25]);
    res.json({ patients:rows.slice(0,25).map(row => decode(row,true)), more:rows.length>25 });
});

router.get('/bookings/:id', async (req,res) => {
    const { rows:[booking] } = await query(`
        SELECT b.id,b.name,b.email,b.phone,b.booking_date::text,b.booking_time::text,l.patient_id
        FROM bookings b LEFT JOIN patient_booking_links l ON l.booking_id=b.id AND l.tenant_id=b.tenant_id
        WHERE b.tenant_id=$1 AND b.id=$2`, [req.tenant.id,id(req.params.id)]);
    if (!booking) fail(404,'Booking not found.');
    res.json({ booking });
});

router.put('/bookings/:id', async (req,res) => {
    await transaction(client => linkBooking(client,req,id(req.params.id),id(req.body?.patientId)));
    res.json({ success:true });
});

router.delete('/bookings/:id', async (req,res) => {
    const bookingId = id(req.params.id);
    const patientId = id(req.body?.patientId);
    await transaction(async client => {
        await lockBooking(client,req.tenant.id,bookingId);
        const { rows } = await client.query(
            'DELETE FROM patient_booking_links WHERE tenant_id=$1 AND booking_id=$2 AND patient_id=$3 RETURNING patient_id',
            [req.tenant.id,bookingId,patientId]);
        if (!rows.length) fail(409,'This booking link has changed. Reload the booking and try again.');
        await audit(client,req,'patient.booking_unlinked',patientId);
    });
    res.json({ success:true });
});

router.post('/', async (req,res) => {
    const [cipher, keys] = encode(req.tenant.id,req.body?.profile);
    const bookingId = req.body?.bookingId ? id(req.body.bookingId) : null;
    const requestId = req.body?.requestId === undefined ? randomUUID() : id(req.body.requestId);
    const result = await transaction(async client => {
        const { rows:[patient] } = await client.query(
            `INSERT INTO booking_patients(id,tenant_id,profile_ciphertext,lookup_keys) VALUES($1,$2,$3,$4)
             ON CONFLICT (id) DO NOTHING RETURNING id`,
            [requestId,req.tenant.id,cipher,keys]);
        if (!patient) {
            const { rows } = await client.query('SELECT id FROM booking_patients WHERE id=$1 AND tenant_id=$2',[requestId,req.tenant.id]);
            if (!rows.length) fail(409,'This request could not be saved. Start a new patient record.');
            return { id:requestId, created:false };
        }
        if (bookingId) await linkBooking(client,req,bookingId,patient.id);
        await audit(client,req,'patient.created',patient.id);
        return { id:patient.id, created:true };
    });
    res.status(result.created ? 201 : 200).json({ id:result.id });
});

router.get('/:id', async (req,res) => {
    const patientId = id(req.params.id);
    const tenantId = req.tenant.id;
    const page = Math.max(1, Math.min(100000, Number.parseInt(req.query.page,10) || 1));
    const { rows:[patient] } = await query('SELECT id,profile_ciphertext,archived_at FROM booking_patients WHERE tenant_id=$1 AND id=$2',
        [tenantId,patientId]);
    if (!patient) fail(404,'Patient not found.');
    const { rows } = await query(`
        SELECT b.id,b.booking_date::text,b.booking_time::text,b.status,s.name AS service_name
        FROM patient_booking_links l JOIN bookings b ON b.id=l.booking_id AND b.tenant_id=l.tenant_id
        LEFT JOIN services s ON s.id=b.service_id AND s.tenant_id=b.tenant_id
        WHERE l.tenant_id=$1 AND l.patient_id=$2 ORDER BY b.booking_date DESC,b.booking_time DESC,b.id LIMIT 26 OFFSET $3`,
    [tenantId,patientId,(page-1)*25]);
    const profile = decode(patient);
    await audit({query},req,'patient.viewed',patientId);
    res.json({ patient:profile, visits:rows.slice(0,25), more:rows.length>25 });
});

router.patch('/:id', async (req,res) => {
    const patientId = id(req.params.id);
    const archive = req.body?.archived;
    const [cipher,keys] = typeof archive === 'boolean' ? [] : encode(req.tenant.id,req.body?.profile);
    await transaction(async client => {
        const [sql,params,event] = typeof archive === 'boolean'
            ? ['archived_at=CASE WHEN $3::boolean THEN COALESCE(archived_at,NOW()) ELSE NULL END',[req.tenant.id,patientId,archive],archive ? 'patient.archived' : 'patient.restored']
            : ['profile_ciphertext=$3,lookup_keys=$4',[req.tenant.id,patientId,cipher,keys],'patient.updated'];
        const { rows } = await client.query(
            `UPDATE booking_patients SET ${sql},updated_at=NOW() WHERE tenant_id=$1 AND id=$2 RETURNING id`,params);
        if (!rows.length) fail(404,'Patient not found.');
        await audit(client,req,event,patientId);
    });
    res.json({ success:true });
});

router.use((error,_req,res,_next) => {
    if (!error.status || error.status >= 500) console.error('[Patients]',error.code || error.name);
    res.status(error.status || 500).json({ error:error.status && error.status < 500 ? error.message : 'Patient workspace request failed.' });
});

module.exports = router;
