const crypto = require('crypto');

// Requires a 32-byte (256-bit) hex string secret in env
// e.g. ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
if (!process.env.ENCRYPTION_KEY) {
    throw new Error('FATAL: ENCRYPTION_KEY environment variable is required to start the application securely.');
}

const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');

const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypt a plain text string.
 * Returns a hex string containing the IV, Auth Tag, and Ciphertext.
 * Format: iv:authTag:encryptedData
 */
function encrypt(text) {
    if (!text) return text;
    
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt a previously encrypted string.
 */
function decrypt(hash) {
    if (!hash || typeof hash !== 'string' || !hash.includes(':')) return hash;
    
    try {
        const parts = hash.split(':');
        const iv = Buffer.from(parts[0], 'hex');
        const authTag = Buffer.from(parts[1], 'hex');
        const encryptedText = parts[2];
        
        const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (err) {
        console.error('[Encryption] Failed to decrypt data:', err.message);
        return null;
    }
}

/**
 * Mask a string for safe frontend display (e.g., •••••••1234)
 */
function maskSecret(secret, visibleChars = 4) {
    if (!secret) return '';
    if (secret.length <= visibleChars) return '*'.repeat(secret.length);
    const visible = secret.slice(-visibleChars);
    return '*'.repeat(secret.length - visibleChars) + visible;
}

module.exports = {
    encrypt,
    decrypt,
    maskSecret
};
