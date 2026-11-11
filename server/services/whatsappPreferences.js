const { query } = require('../db/connection');
const { normalizeWhatsappNumber } = require('./whatsappPhone');
// Update this version and the effective date on /whatsapp-terms together.
const WHATSAPP_TERMS_VERSION = '2026-11-11';

async function getWhatsAppPreferences(tenantId, runQuery = query) {
    const { rows } = await runQuery(`
        SELECT COALESCE(p.enabled, false) AS enabled,
               COALESCE(p.providers, '[]') AS providers,
               COALESCE(p.reminders, '[24,2]') AS reminders,
               EXISTS (SELECT 1 FROM whatsapp_settings WHERE id = 1
                   AND config->>'enabled' = 'true'
                   AND NULLIF(config->>'sid', '') IS NOT NULL
                   AND NULLIF(config->>'from', '') IS NOT NULL
                   AND NULLIF(config->>'token', '') IS NOT NULL) AS platform_enabled
        FROM tenants t LEFT JOIN whatsapp_preferences p ON p.tenant_id = t.id
        WHERE t.id = $1`, [tenantId]);
    return rows[0];
}

function validateWhatsAppPreferences(input) {
    const { enabled, providers, reminders } = input || {};
    if (typeof enabled !== 'boolean' || !Array.isArray(providers) || providers.length > 20 ||
        !Array.isArray(reminders) || reminders.length > 4 || reminders.some(h => !Number.isInteger(h) || h < 1 || h > 168)) {
        throw new Error('Choose whether to enable WhatsApp, add up to 20 recipients, and use up to 4 reminder times from 1 to 168 hours.');
    }
    const recipients = providers.map(provider => ({
        name: String(provider?.name || '').trim().slice(0, 100),
        phone: normalizeWhatsappNumber(provider?.phone),
        opt_in: provider?.opt_in === true
    }));
    if (recipients.some(p => !p.name || !p.phone)) throw new Error('Each recipient needs a name and a valid WhatsApp number.');
    if (new Set(recipients.map(p => p.phone)).size !== recipients.length) throw new Error('Enter each WhatsApp number only once.');
    return { enabled, providers: recipients, reminders: [...new Set(reminders)] };
}

async function saveWhatsAppPreferences(tenantId, { enabled, providers, reminders }, dailyLimit = null) {
    const recipients = providers.map(provider => provider.opt_in
        ? { ...provider, consent_recorded_at: new Date().toISOString() }
        : provider);
    await query(`
        INSERT INTO whatsapp_preferences AS p (tenant_id, enabled, providers, reminders, daily_limit)
        VALUES ($1, $2, $3, $4, COALESCE($5, 100))
        ON CONFLICT (tenant_id) DO UPDATE SET
            enabled = EXCLUDED.enabled,
            providers = (SELECT COALESCE(jsonb_agg(
                CASE WHEN recipient->>'opt_in' = 'true' THEN recipient || jsonb_build_object(
                    'consent_recorded_at', COALESCE((SELECT previous->>'consent_recorded_at'
                        FROM jsonb_array_elements(p.providers) previous
                        WHERE previous->>'phone' = recipient->>'phone' AND previous->>'opt_in' = 'true'
                        LIMIT 1), NOW()::text)) ELSE recipient END
            ), '[]') FROM jsonb_array_elements(EXCLUDED.providers) recipient),
            reminders = EXCLUDED.reminders,
            daily_limit = COALESCE($5, p.daily_limit),
            enabled_at = CASE WHEN EXCLUDED.enabled AND NOT p.enabled THEN NOW() ELSE p.enabled_at END,
            updated_at = NOW()`, [tenantId, enabled, JSON.stringify(recipients), JSON.stringify(reminders), dailyLimit]);
}

async function bookingWhatsAppStatus(tenantId, phone, optedIn, runQuery) {
    if (optedIn !== true) return 'not_requested';
    const preferences = await getWhatsAppPreferences(tenantId, runQuery);
    if (!preferences?.enabled || !preferences.platform_enabled) return 'unavailable';
    const recipient = normalizeWhatsappNumber(phone);
    if (!recipient) {
        const err = new Error('Enter your full WhatsApp number, including the country code, or uncheck WhatsApp updates.');
        err.status = 400;
        throw err;
    }
    const blocked = await runQuery('SELECT 1 FROM whatsapp_optouts WHERE phone = $1', [recipient]);
    return blocked.rows.length ? 'unavailable' : 'pending';
}

module.exports = { WHATSAPP_TERMS_VERSION, getWhatsAppPreferences, validateWhatsAppPreferences, saveWhatsAppPreferences, bookingWhatsAppStatus };
