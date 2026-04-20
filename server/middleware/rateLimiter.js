/**
 * Rate Limiter Middleware
 * Per-tenant + per-IP rate limiting to prevent abuse.
 */

const rateLimit = require('express-rate-limit');

const rateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 minutes
    max: 200,                   // Max 200 requests per 15 mins per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please slow down and try again later.' }
});

// Stricter limit for payment endpoints to prevent brute force
const paymentLimiter = rateLimit({
    windowMs: 60 * 1000,  // 1 minute
    max: 10,
    message: { error: 'Too many payment requests. Please wait before retrying.' }
});

// Stricter limit for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Too many login attempts. Please wait 15 minutes.' }
});

module.exports = { rateLimiter, paymentLimiter, authLimiter };
