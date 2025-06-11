const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// General API rate limiter
const apiLimiter = rateLimit({
    store: new RedisStore({
        client: redis,
        prefix: 'rl:api:'
    }),
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        statusCode: 429,
        message: 'Terlalu banyak permintaan, silakan coba lagi nanti'
    }
});

// Stricter limiter for authentication endpoints
const authLimiter = rateLimit({
    store: new RedisStore({
        client: redis,
        prefix: 'rl:auth:'
    }),
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // Limit each IP to 5 requests per windowMs
    message: {
        statusCode: 429,
        message: 'Terlalu banyak percobaan login, silakan coba lagi dalam 1 jam'
    }
});

// Driver request limiter
const driverRequestLimiter = rateLimit({
    store: new RedisStore({
        client: redis,
        prefix: 'rl:driver:'
    }),
    windowMs: 60 * 1000, // 1 minute
    max: 10, // Limit each driver to 10 requests per minute
    message: {
        statusCode: 429,
        message: 'Terlalu banyak permintaan, silakan tunggu sebentar'
    }
});

module.exports = {
    apiLimiter,
    authLimiter,
    driverRequestLimiter
};