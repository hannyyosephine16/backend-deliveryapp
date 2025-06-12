require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { requestLogger, errorLogger } = require('./utils/logger');
const { apiLimiter, authLimiter } = require('./middleware/rateLimiter');
const cache = require('./utils/cache');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const swaggerDocument = YAML.load('./swagger.yaml');

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

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
    customSiteTitle: 'DelPick API Documentation',
    customCss: '.swagger-ui .topbar { display: none }',
    customfavIcon: '/favicon.ico'
}));

// Routes
app.use('/api/v1', require('./routes'));

// Error handling
app.use(errorLogger);
app.use((err, req, res, next) => {
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
    console.log(`Dokumentasi API tersedia di http://localhost:${PORT}/api-docs`);

    // Note: Background jobs are now handled by worker.js
    console.log('Background jobs akan dijalankan oleh worker.js - jalankan: node worker.js');
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
