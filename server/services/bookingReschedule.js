/**
 * Rescheduling & self-service ("Manage my booking")
 *
 *  - Signed manage links let a customer reschedule or cancel from their email
 *    without an account. The token lives in the URL fragment (#t=…) so it is
 *    never written to server logs or sent as a referrer.
 *  - Each business sets a policy: whether clients may reschedule/cancel online,
 *    how close to the appointment changes stop, how many reschedules are
 *    allowed, and whether staff must approve a client's new time.
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const RESCHEDULABLE_STATUSES = ['confirmed', 'pending_payment', 'pending_manual_confirmation', 'pending_after_hours_confirmation'];

const CLIENT_REASONS = {
    schedule_conflict: 'Schedule conflict',
    work: 'Work commitment',
    illness: 'Feeling unwell',
    transport: 'Transport issue',
    family: 'Family matter',
    weather: 'Weather',
    other: 'Other'
};

const STAFF_REASONS = {
    client_request: 'Client asked to move it',
    staff_unavailable: 'Staff member unavailable',
    emergency: 'Emergency / unexpected closure',
    overbooked: 'Double-booked or overbooked',
    equipment: 'Equipment or venue issue',
    weather: 'Weather',
    other: 'Other'
};

const DEFAULT_POLICY = {
    allowClientReschedule: true,
    allowClientCancel: true,
    cutoffHours: 24,
    maxReschedules: 2,
    requireApproval: false,
    reasonRequired: true
};

function normalizePolicy(raw = {}) {
    const policy = { ...DEFAULT_POLICY };
    if (raw && typeof raw === 'object') {
        for (const key of ['allowClientReschedule', 'allowClientCancel', 'requireApproval', 'reasonRequired']) {
            if (typeof raw[key] === 'boolean') policy[key] = raw[key];
        }
        const cutoff = Number(raw.cutoffHours);
        if (Number.isFinite(cutoff)) policy.cutoffHours = Math.min(336, Math.max(0, Math.round(cutoff)));
        const max = Number(raw.maxReschedules);
        if (Number.isFinite(max)) policy.maxReschedules = Math.min(10, Math.max(0, Math.round(max)));
    }
    return policy;
}

// ── Manage links ─────────────────────────────────────────────────────────────
// Separate signing domain: manage links can never authenticate as account tokens.
const signingKey = () => crypto
    .createHmac('sha256', process.env.JWT_SECRET || 'dev_secret_change_in_production')
    .update('icss-booking-manage-v1')
    .digest('hex');

function manageToken(booking) {
    return jwt.sign({ tenantId: booking.tenant_id }, signingKey(), {
        algorithm: 'HS256', audience: 'booking-manage', subject: booking.id, expiresIn: '400d'
    });
}

function verifyManageToken(token) {
    if (typeof token !== 'string' || token.length > 2000) throw new Error('This link is not valid.');
    const claims = jwt.verify(token, signingKey(), { algorithms: ['HS256'], audience: 'booking-manage' });
    if (!/^[0-9a-f-]{36}$/i.test(claims.sub || '') || !/^[0-9a-f-]{36}$/i.test(claims.tenantId || '')) {
        throw new Error('This link is not valid.');
    }
    return { bookingId: claims.sub, tenantId: claims.tenantId };
}

function appBaseUrl() {
    return String(process.env.PUBLIC_APP_URL || process.env.BASE_URL || 'https://icssbookings.com').replace(/\/+$/, '');
}

function manageUrl(booking) {
    return `${appBaseUrl()}/manage#t=${encodeURIComponent(manageToken(booking))}`;
}

// ── Eligibility ──────────────────────────────────────────────────────────────
/**
 * What a customer may do with this booking right now, and why not if they can't.
 */
function clientOptions(booking, policy, now = new Date()) {
    const active = RESCHEDULABLE_STATUSES.includes(booking.status);
    const start = booking.start_time ? new Date(booking.start_time) : null;
    const hoursAway = start ? (start.getTime() - now.getTime()) / 36e5 : Infinity;
    const insideCutoff = hoursAway < policy.cutoffHours;
    const used = Number(booking.reschedule_count || 0);

    const result = { canReschedule: false, canCancel: false, rescheduleBlockedReason: null, cancelBlockedReason: null, hoursAway, remainingReschedules: Math.max(0, policy.maxReschedules - used) };
    if (!active) {
        const label = { cancelled: 'cancelled', rejected: 'declined', completed: 'completed', expired: 'expired', no_show: 'closed' }[booking.status] || 'closed';
        result.rescheduleBlockedReason = result.cancelBlockedReason = `This booking is ${label}.`;
        return result;
    }
    if (start && hoursAway <= 0) {
        result.rescheduleBlockedReason = result.cancelBlockedReason = 'This appointment has already started.';
        return result;
    }
    const cutoffText = `Changes online close ${policy.cutoffHours} hour${policy.cutoffHours === 1 ? '' : 's'} before your appointment. Please contact the business directly.`;

    if (!policy.allowClientReschedule) result.rescheduleBlockedReason = 'This business handles rescheduling directly. Please contact them.';
    else if (insideCutoff) result.rescheduleBlockedReason = cutoffText;
    else if (used >= policy.maxReschedules) result.rescheduleBlockedReason = `This booking has already been rescheduled ${used} time${used === 1 ? '' : 's'}, the most allowed online. Please contact the business.`;
    else result.canReschedule = true;

    if (!policy.allowClientCancel) result.cancelBlockedReason = 'This business handles cancellations directly. Please contact them.';
    else if (insideCutoff) result.cancelBlockedReason = cutoffText;
    else result.canCancel = true;

    return result;
}

function reasonLabel(code, actor) {
    const catalogue = actor === 'staff' ? STAFF_REASONS : CLIENT_REASONS;
    return catalogue[code] || null;
}

/** Normalise a reason from either side into { code, text, label }. */
function normalizeReason({ reasonCode, reason }, actor, { required } = {}) {
    const catalogue = actor === 'staff' ? STAFF_REASONS : CLIENT_REASONS;
    const code = catalogue[reasonCode] ? reasonCode : (reason ? 'other' : null);
    const text = String(reason || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 500);
    if (required && !code) {
        const err = new Error('Please choose a reason.'); err.status = 400; throw err;
    }
    if (code === 'other' && required && !text) {
        const err = new Error('Please tell us a little about the reason.'); err.status = 400; throw err;
    }
    const label = code ? catalogue[code] : null;
    return { code, text, label, display: [label && label !== 'Other' ? label : null, text].filter(Boolean).join(' — ') || label || '' };
}

module.exports = {
    RESCHEDULABLE_STATUSES,
    CLIENT_REASONS,
    STAFF_REASONS,
    DEFAULT_POLICY,
    normalizePolicy,
    manageToken,
    verifyManageToken,
    manageUrl,
    clientOptions,
    reasonLabel,
    normalizeReason
};
