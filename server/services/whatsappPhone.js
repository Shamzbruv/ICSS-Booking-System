function normalizeWhatsappNumber(value) {
    const raw = String(value || '').replace(/^whatsapp:/, '').trim();
    const digits = raw.replace(/\D/g, '');
    if (raw.startsWith('+') && digits.length >= 8 && digits.length <= 15) return '+' + digits;
    if (digits.length === 10) return '+1' + digits;
    if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
    return null;
}

module.exports = { normalizeWhatsappNumber };
