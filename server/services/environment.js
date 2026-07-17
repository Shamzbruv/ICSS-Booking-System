const REQUIRED_PRODUCTION = [
    'DATABASE_URL','JWT_SECRET','RESEND_API_KEY','PUBLIC_APP_URL','ENCRYPTION_KEY','TOKEN_ENCRYPTION_KEY',
    'PLATFORM_ADMIN_KEY','PAYPAL_CLIENT_ID','PAYPAL_SECRET','PAYPAL_WEBHOOK_ID'
];

function validateEnvironment(env = process.env, { production = env.NODE_ENV === 'production' } = {}) {
    const errors = [];
    const required = production ? REQUIRED_PRODUCTION : ['DATABASE_URL','JWT_SECRET','ENCRYPTION_KEY'];
    required.forEach(key => { if (!String(env[key] || '').trim()) errors.push(`${key} is required`); });
    ['ENCRYPTION_KEY','TOKEN_ENCRYPTION_KEY'].forEach(key => {
        if (env[key] && !/^[a-f0-9]{64}$/i.test(String(env[key]))) errors.push(`${key} must be exactly 64 hexadecimal characters`);
    });
    if (production && !String(env.PAYPAL_PLAN_ID || env.PAYPAL_TRIAL_PLAN_ID || '').trim()) errors.push('PAYPAL_PLAN_ID or PAYPAL_TRIAL_PLAN_ID is required');
    if (production && String(env.JWT_SECRET || '').length < 32) errors.push('JWT_SECRET must contain at least 32 characters');
    if (production && String(env.PLATFORM_ADMIN_KEY || '').length < 32) errors.push('PLATFORM_ADMIN_KEY must contain at least 32 characters');
    if (env.PUBLIC_APP_URL) {
        try { const url = new URL(env.PUBLIC_APP_URL); if (production && url.protocol !== 'https:') errors.push('PUBLIC_APP_URL must use https in production'); }
        catch { errors.push('PUBLIC_APP_URL must be an absolute URL'); }
    }
    if (errors.length) throw new Error(`Environment validation failed:\n- ${errors.join('\n- ')}`);
    return true;
}

module.exports = { validateEnvironment, REQUIRED_PRODUCTION };
