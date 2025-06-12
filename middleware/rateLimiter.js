const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const Redis = require('ioredis');

const redis = new Redis({
    port: process.env.REDIS_PORT || 6379,
    host: process.env.REDIS_HOST || 'localhost',
    password: process.env.REDIS_PASSWORD,
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined
});

// General API rate limiter
const apiLimiter = rateLimit({
    store: new RedisStore({
        sendCommand: (...args) => redis.call(...args),
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
        sendCommand: (...args) => redis.call(...args),
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
        sendCommand: (...args) => redis.call(...args),
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