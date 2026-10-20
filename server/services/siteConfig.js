/**
 * Tenant Website Config
 *
 * A tenant's public website (Home / About / Gallery / Book) is described by a
 * single JSON document. The admin Website Builder edits a *draft* copy; the
 * public site only ever reads the *published* copy.
 *
 *   tenants.site_draft    — work in progress, autosaved by the builder
 *   tenants.site_config   — what customers see
 *
 * Content is rendered by React (text is escaped), so the sanitiser's job is to
 * keep the document bounded in size and to make sure every link / media URL is
 * http(s), a same-origin media path, or an in-page anchor.
 */

const MAX_SITE_BYTES = 256 * 1024;
const MAX_DEPTH = 10;
const MAX_ARRAY_ITEMS = 80;
const MAX_STRING = 6000;

// Theme name → website preset key (frontend/src/site/themePresets.js).
const THEME_KEYS = {
    'Island Occasion Rentals': 'party-rentals',
    'Island Drive Rentals': 'car-rental',
    'Yaad Table Catering': 'catering',
    'Fresh Ride Detailing': 'detailing',
    'YaadFix Home Services': 'home-repairs',
    'BrightPath Tutoring': 'tutoring',
    'Iron & Blade': 'barber',
    'Botanica Spa': 'spa',
    'Pro Auto Care': 'mechanic',
    'Gather & Grace': 'events',
    'Pulse Studio': 'fitness',
    'Blush & Braids': 'hairdresser',
    'Serenity Health': 'health',
    'Meridian Law': 'law',
    'Elegant Nails': 'nail-tech',
    'Polished & Pure': 'nail-tech',
    'Lumina Lens': 'photography',
    'GreenScape Landscaping': 'landscaping',
    'FreshStart Cleaning': 'cleaning',
    'Universal Services': 'universal'
};

// Legacy static template files → live demo of the same theme.
const TEMPLATE_FILE_KEYS = {
    'party-rentals.html': 'party-rentals',
    'car-rental.html': 'car-rental',
    'catering.html': 'catering',
    'detailing.html': 'detailing',
    'home-repairs.html': 'home-repairs',
    'tutoring.html': 'tutoring',
    'barber.html': 'barber',
    'spa.html': 'spa',
    'mechanic.html': 'mechanic',
    'events.html': 'events',
    'fitness.html': 'fitness',
    'hairdresser.html': 'hairdresser',
    'health.html': 'health',
    'law.html': 'law',
    'nail_tech.html': 'nail-tech',
    'photography.html': 'photography',
    'landscaping.html': 'landscaping',
    'cleaning.html': 'cleaning',
    'universal_booking.html': 'universal'
};

function themeKeyForName(name) {
    return THEME_KEYS[name] || 'universal';
}

const URL_KEY_PATTERN = /(url|href|link|src|poster)$/i;

function sanitizeUrl(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    if (text.startsWith('/media/') && /^\/media\/[0-9a-f-]{36}$/i.test(text)) return text;
    if (/^#[A-Za-z0-9_-]{0,60}$/.test(text)) return text;
    if (/^(mailto|tel):[^\s<>"']{1,200}$/i.test(text)) return text;
    try {
        const parsed = new URL(text);
        return ['https:', 'http:'].includes(parsed.protocol) ? parsed.toString() : '';
    } catch {
        return '';
    }
}

function sanitizeNode(value, key, depth) {
    if (depth > MAX_DEPTH) return undefined;
    if (value === null) return null;
    if (Array.isArray(value)) {
        return value.slice(0, MAX_ARRAY_ITEMS)
            .map((item) => sanitizeNode(item, key, depth + 1))
            .filter((item) => item !== undefined);
    }
    switch (typeof value) {
        case 'string':
            if (key && URL_KEY_PATTERN.test(key)) return sanitizeUrl(value);
            return value.slice(0, MAX_STRING);
        case 'number':
            return Number.isFinite(value) ? value : 0;
        case 'boolean':
            return value;
        case 'object': {
            const out = {};
            for (const [childKey, childValue] of Object.entries(value)) {
                if (!/^[A-Za-z0-9_-]{1,60}$/.test(childKey)) continue;
                if (childKey === '__proto__' || childKey === 'constructor' || childKey === 'prototype') continue;
                const cleaned = sanitizeNode(childValue, childKey, depth + 1);
                if (cleaned !== undefined) out[childKey] = cleaned;
            }
            return out;
        }
        default:
            return undefined;
    }
}

/**
 * Returns a sanitised copy of the site document, or throws a user-facing Error.
 */
function sanitizeSiteConfig(site) {
    if (!site || typeof site !== 'object' || Array.isArray(site)) {
        throw new Error('Website settings must be an object.');
    }
    const size = Buffer.byteLength(JSON.stringify(site), 'utf8');
    if (size > MAX_SITE_BYTES) {
        throw new Error('Website settings are too large. Remove some sections or shorten long text.');
    }
    const cleaned = sanitizeNode(site, '', 0);
    cleaned.version = 1;
    return cleaned;
}

module.exports = {
    THEME_KEYS,
    TEMPLATE_FILE_KEYS,
    themeKeyForName,
    sanitizeSiteConfig,
    sanitizeUrl,
    MAX_SITE_BYTES
};
