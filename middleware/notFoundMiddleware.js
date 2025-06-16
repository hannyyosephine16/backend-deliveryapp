'use strict';

const response = require('../utils/response');
const { logger } = require('../utils/logger');

/**
 * Middleware to handle 404 Not Found errors
 * This middleware should be placed after all routes
 */
const notFoundHandler = (req, res, next) => {
    logger.warn(`Route not found: ${req.method} ${req.originalUrl}`);
    return response.error(res, `Route ${req.method} ${req.originalUrl} not found`, 404);
};

module.exports = notFoundHandler; 