const jwt = require('jsonwebtoken');
const crypto = require('crypto');
// Separate signing domain: review invitations can never authenticate as account tokens.
const signingKey = () => crypto.createHmac('sha256', process.env.JWT_SECRET || 'dev_secret_change_in_production').update('icss-booking-review-v1').digest('hex');
function reviewToken(booking) {
    return jwt.sign({ tenantId: booking.tenant_id }, signingKey(), { algorithm: 'HS256', audience: 'booking-review', subject: booking.id, expiresIn: '180d' });
}
function verifyReviewToken(token, tenantId) {
    if (typeof token !== 'string' || token.length > 2000) throw new Error('Invalid review invitation.');
    const claims = jwt.verify(token, signingKey(), { algorithms: ['HS256'], audience: 'booking-review' });
    if (claims.tenantId !== tenantId || !/^[0-9a-f-]{36}$/i.test(claims.sub || '')) throw new Error('Invalid review invitation.');
    return claims.sub;
}
function reviewUrl(booking, tenant) {
    const base = String(process.env.PUBLIC_APP_URL || process.env.BASE_URL || 'https://icssbookings.com').replace(/\/$/, '');
    // The invitation stays in the URL fragment so it is not sent in server logs or referrers.
    return `${base}/${encodeURIComponent(tenant.slug)}/book#review=${encodeURIComponent(reviewToken(booking))}`;
}
function reviewerName(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    return `${parts[0] || 'Customer'}${parts.length > 1 ? ` ${Array.from(parts[parts.length - 1])[0]}.` : ''}`.slice(0, 80);
}
module.exports = { reviewToken, verifyReviewToken, reviewUrl, reviewerName };
