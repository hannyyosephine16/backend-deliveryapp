require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { requestLogger, errorLogger } = require('./utils/logger');
const { apiLimiter, authLimiter } = require('./middleware/rateLimiter');
const cache = require('./utils/cache');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use(requestLogger);

// Rate limiting
app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);

// Cache middleware for GET requests
app.use('/api/stores', cache.middleware(300)); // Cache store data for 5 minutes
app.use('/api/menu', cache.middleware(300)); // Cache menu data for 5 minutes

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/stores', require('./routes/stores'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/drivers', require('./routes/drivers'));
app.use('/api/tracking', require('./routes/tracking'));

// Error handling
app.use(errorLogger);
app.use((err, req, res) => {
    console.error(err.stack);
    res.status(500).json({
        statusCode: 500,
        message: 'Terjadi kesalahan pada server',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server berjalan di port ${PORT}`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

module.exports = app;
