/** Convert legacy embedded website images to durable, tenant-owned media URLs.
 * Validate the complete document before uploading anything. Keep the existing
 * 256 KB settings limit; image bytes belong in tenant_media, not the JSON.
 */
const { randomUUID } = require('node:crypto');
const { sanitizeSiteConfig } = require('./siteConfig');
const { query } = require('../db/connection');
const { storeMedia, looksLikeDeclaredType, MEDIA_RULES } = require('./media');

async function prepareSiteConfig(site, tenantId, dependencies = {}) {
    const images = new Map();
    const placeholders = new Map();
    function replace(value, key = '', depth = 0) {
        if (depth > 10) return value;
        if (typeof value === 'string' && /(url|href|link|src|poster)$/i.test(key) && /^data:image\//i.test(value)) {
            if (images.has(value)) return images.get(value).placeholder;
            const match = /^data:(image\/(?:png|jpeg|webp|gif|avif));base64,([A-Za-z0-9+/]+={0,2})$/i.exec(value);
            if (!match || match[2].length % 4 !== 0) throw new Error('An embedded image could not be read. Please upload that image again.');
            const mime = match[1].toLowerCase();
            const buffer = Buffer.from(match[2], 'base64');
            if (buffer.length > MEDIA_RULES.image.maxBytes || !looksLikeDeclaredType(buffer, mime)) {
                throw new Error('An embedded image is invalid or too large. Please upload that image through the media library.');
            }
            const image = { buffer, mime, placeholder: `/media/${randomUUID()}` };
            images.set(value, image);
            return image.placeholder;
        }
        if (Array.isArray(value)) return value.map(item => replace(item, key, depth + 1));
        if (value && typeof value === 'object') {
            return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, replace(child, childKey, depth + 1)]));
        }
        return value;
    }
    const cleaned = sanitizeSiteConfig(replace(site));
    const serialized = JSON.stringify(cleaned);
    const findMedia = dependencies.findMedia || (async image => {
        const result = await query(
            `SELECT id FROM tenant_media WHERE tenant_id=$1 AND mime=$2 AND size_bytes=$3 AND data=$4 LIMIT 1`,
            [tenantId, image.mime, image.buffer.length, image.buffer]
        );
        return result.rows[0] ? { url: `/media/${result.rows[0].id}` } : null;
    });
    const saveMedia = dependencies.saveMedia || (image => storeMedia(tenantId, {
        buffer: image.buffer, mime: image.mime, filename: `website-image.${image.mime.split('/')[1]}`
    }));
    for (const image of images.values()) {
        if (!serialized.includes(image.placeholder)) continue;
        const stored = await findMedia(image) || await saveMedia(image);
        placeholders.set(image.placeholder, stored.url);
    }
    function resolve(value) {
        if (typeof value === 'string') return placeholders.get(value) || value;
        if (Array.isArray(value)) return value.map(resolve);
        if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, resolve(child)]));
        return value;
    }
    return resolve(cleaned);
}

module.exports = { prepareSiteConfig };
