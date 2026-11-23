const EMAIL = /^[a-z\d.!#$%&'*+/=?^_`{|}~-]+@[a-z\d](?:[a-z\d.-]*[a-z\d])?\.[a-z]{2,63}$/i;

function normalizeEmail(value) {
    const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return email.length <= 254 && EMAIL.test(email) && !email.includes('..') ? email : '';
}

async function getTenantReplySettings(db, tenantId) {
    if (!tenantId) return { configured:'', effective:'' };
    const { rows: [row] } = await db(`
        SELECT email_reply_to, branding->>'replyEmail' AS legacy_reply, site_config#>>'{contact,email}' AS website_email,
            ARRAY(SELECT email FROM users WHERE tenant_id=tenants.id AND active AND role IN ('tenant_admin','staff')
                  ORDER BY CASE role WHEN 'tenant_admin' THEN 0 ELSE 1 END, created_at NULLS LAST,id) AS team_emails
        FROM tenants WHERE id=$1`, [tenantId]);
    if (!row) return { configured:'', effective:'' };
    const configured = normalizeEmail(row.email_reply_to);
    const legacy = String(row.legacy_reply || '').split(',');
    const effective = [configured, ...legacy, row.website_email, ...row.team_emails].map(normalizeEmail).find(Boolean) || '';
    return { configured, effective };
}

async function tenantReplyAddress(db, tenantId) {
    const settings = await getTenantReplySettings(db, tenantId);
    return settings.effective || undefined;
}

module.exports = { normalizeEmail, getTenantReplySettings, tenantReplyAddress };
