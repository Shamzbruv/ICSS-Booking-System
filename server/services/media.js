/**
 * Tenant Media Library
 *
 * Stores website media (hero images/videos, gallery photos, theme music) in
 * Postgres so uploads survive container redeploys without extra infrastructure.
 * The `data` column uses EXTERNAL storage, which lets us read byte ranges
 * cheaply — required for video seeking on iOS Safari.
 */

const { query } = require('../db/connection');

const MEDIA_RULES = {
    image: {
        mimes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'],
        maxBytes: 8 * 1024 * 1024
    },
    video: {
        mimes: ['video/mp4', 'video/webm', 'video/quicktime'],
        maxBytes: 40 * 1024 * 1024
    },
    audio: {
        mimes: ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/x-m4a'],
        maxBytes: 12 * 1024 * 1024
    }
};

const TENANT_QUOTA_BYTES = 250 * 1024 * 1024;
const MAX_UPLOAD_BYTES = Math.max(...Object.values(MEDIA_RULES).map((rule) => rule.maxBytes));

function kindForMime(mime) {
    const normalized = String(mime || '').toLowerCase().split(';')[0].trim();
    for (const [kind, rule] of Object.entries(MEDIA_RULES)) {
        if (rule.mimes.includes(normalized)) return { kind, mime: normalized };
    }
    return null;
}

// Light magic-number check so a renamed executable can't be served as an image.
function looksLikeDeclaredType(buffer, mime) {
    if (!buffer || buffer.length < 12) return false;
    const hex = buffer.subarray(0, 12).toString('hex');
    const ascii = buffer.subarray(0, 12).toString('latin1');
    switch (mime) {
        case 'image/jpeg': return hex.startsWith('ffd8ff');
        case 'image/png': return hex.startsWith('89504e47');
        case 'image/gif': return ascii.startsWith('GIF8');
        case 'image/webp': return ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP';
        case 'image/avif': return ascii.slice(4, 8) === 'ftyp';
        case 'video/mp4':
        case 'video/quicktime':
        case 'audio/mp4':
        case 'audio/x-m4a': return ascii.slice(4, 8) === 'ftyp';
        case 'video/webm': return hex.startsWith('1a45dfa3');
        case 'audio/ogg': return ascii.startsWith('OggS');
        case 'audio/wav': return ascii.startsWith('RIFF');
        case 'audio/mpeg':
        case 'audio/mp3': return ascii.startsWith('ID3') || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
        case 'audio/aac': return buffer[0] === 0xff && (buffer[1] & 0xf0) === 0xf0;
        default: return false;
    }
}

function cleanFilename(name) {
    return String(name || 'upload').replace(/[^A-Za-z0-9._ -]/g, '').slice(0, 120) || 'upload';
}

function toPublicRow(row) {
    return {
        id: row.id,
        kind: row.kind,
        mime: row.mime,
        filename: row.filename,
        size_bytes: Number(row.size_bytes),
        width: row.width,
        height: row.height,
        duration_seconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
        url: `/media/${row.id}`,
        created_at: row.created_at
    };
}

async function storeMedia(tenantId, { buffer, mime, filename, width, height, duration }) {
    const detected = kindForMime(mime);
    if (!detected) {
        const err = new Error('Unsupported file type. Use JPG, PNG, WebP or GIF images, MP4/WebM video, or MP3/M4A audio.');
        err.status = 415;
        throw err;
    }
    const rule = MEDIA_RULES[detected.kind];
    if (!buffer || buffer.length === 0) {
        const err = new Error('The uploaded file is empty.'); err.status = 400; throw err;
    }
    if (buffer.length > rule.maxBytes) {
        const err = new Error(`That ${detected.kind} is too large. The limit is ${Math.round(rule.maxBytes / 1024 / 1024)}MB.`);
        err.status = 413;
        throw err;
    }
    if (!looksLikeDeclaredType(buffer, detected.mime)) {
        const err = new Error('The file contents do not match its type. Please export it again and retry.');
        err.status = 415;
        throw err;
    }

    const usage = await query(`SELECT COALESCE(SUM(size_bytes),0) AS used FROM tenant_media WHERE tenant_id = $1`, [tenantId]);
    if (Number(usage.rows[0].used) + buffer.length > TENANT_QUOTA_BYTES) {
        const err = new Error('Your media library is full (250MB). Delete unused files in the Website Builder → Media tab.');
        err.status = 413;
        throw err;
    }

    const toInt = (value) => (Number.isFinite(Number(value)) && Number(value) > 0 ? Math.round(Number(value)) : null);
    const result = await query(
        `INSERT INTO tenant_media (tenant_id, kind, mime, filename, size_bytes, width, height, duration_seconds, data)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id, kind, mime, filename, size_bytes, width, height, duration_seconds, created_at`,
        [tenantId, detected.kind, detected.mime, cleanFilename(filename), buffer.length,
         toInt(width), toInt(height), Number.isFinite(Number(duration)) && Number(duration) > 0 ? Number(duration) : null, buffer]
    );
    return toPublicRow(result.rows[0]);
}

async function listMedia(tenantId) {
    const result = await query(
        `SELECT id, kind, mime, filename, size_bytes, width, height, duration_seconds, created_at
         FROM tenant_media WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 300`,
        [tenantId]
    );
    const usage = result.rows.reduce((sum, row) => sum + Number(row.size_bytes), 0);
    return { media: result.rows.map(toPublicRow), used_bytes: usage, quota_bytes: TENANT_QUOTA_BYTES };
}

async function deleteMedia(tenantId, id) {
    const result = await query(`DELETE FROM tenant_media WHERE id = $1 AND tenant_id = $2 RETURNING id`, [id, tenantId]);
    return result.rows.length > 0;
}

function parseRange(header, size) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(String(header || '').trim());
    if (!match) return null;
    let start = match[1] === '' ? null : Number(match[1]);
    let end = match[2] === '' ? null : Number(match[2]);
    if (start === null && end === null) return null;
    if (start === null) { start = Math.max(0, size - end); end = size - 1; }
    if (end === null || end >= size) end = size - 1;
    if (start > end || start >= size) return 'invalid';
    return { start, end };
}

const CHUNK = 1024 * 1024;

/** Express handler: GET /media/:id */
async function serveMedia(req, res) {
    const { id } = req.params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(404).end();
    try {
        const meta = await query(`SELECT mime, size_bytes, created_at FROM tenant_media WHERE id = $1`, [id]);
        if (meta.rows.length === 0) return res.status(404).end();
        const { mime, created_at: createdAt } = meta.rows[0];
        const size = Number(meta.rows[0].size_bytes);
        const etag = `"${id}"`;

        res.setHeader('Content-Type', mime);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.setHeader('ETag', etag);
        res.setHeader('Last-Modified', new Date(createdAt).toUTCString());
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

        if (req.headers['if-none-match'] === etag) return res.status(304).end();

        const range = req.headers.range ? parseRange(req.headers.range, size) : null;
        if (range === 'invalid') {
            res.setHeader('Content-Range', `bytes */${size}`);
            return res.status(416).end();
        }

        const start = range ? range.start : 0;
        const end = range ? range.end : size - 1;
        const length = end - start + 1;
        res.status(range ? 206 : 200);
        if (range) res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
        res.setHeader('Content-Length', length);
        if (req.method === 'HEAD') return res.end();

        // Stream in 1MB slices so a large video never sits fully in memory.
        for (let offset = start; offset <= end; offset += CHUNK) {
            const take = Math.min(CHUNK, end - offset + 1);
            const slice = await query(`SELECT substring(data FROM $2 FOR $3) AS chunk FROM tenant_media WHERE id = $1`, [id, offset + 1, take]);
            if (!slice.rows.length) break;
            if (!res.write(slice.rows[0].chunk)) {
                await new Promise((resolve) => res.once('drain', resolve));
            }
            if (res.destroyed) return;
        }
        res.end();
    } catch (err) {
        console.error('[Media/Serve]', err.message);
        if (!res.headersSent) res.status(500).end();
        else res.end();
    }
}

module.exports = {
    MEDIA_RULES,
    MAX_UPLOAD_BYTES,
    TENANT_QUOTA_BYTES,
    kindForMime,
    looksLikeDeclaredType,
    parseRange,
    storeMedia,
    listMedia,
    deleteMedia,
    serveMedia
};
