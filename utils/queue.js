const Bull = require('bull');

const orderQueue = new Bull('order-queue', {
    redis: {
        host: '127.0.0.1',
        port: 6379,
        password: '1ee5e566'
    },
    settings: {
        stalledInterval: 30000, // Memeriksa stalled job setiap 30 detik
        maxStalledCount: 2,     // Job dianggap failed setelah 2x stalled
        retryProcessDelay: 5000 // Delay sebelum retry proses yang failed
    }
});

module.exports = orderQueue;