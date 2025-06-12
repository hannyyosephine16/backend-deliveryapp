const express = require('express');
const router = express.Router();

// Import all routes
const authRoutes = require('./authRoutes');
const customerRoutes = require('./customerRoutes');
const storeRoutes = require('./storeRoutes');
const menuItemRoutes = require('./menuItemRoutes');
const orderRoutes = require('./orderRoutes');
const driverRoutes = require('./driverRoutes');
const driverRequestRoutes = require('./driverRequestRoutes');
const trackingRoutes = require('./trackingRoutes');

// Mount routes
router.use('/auth', authRoutes);
router.use('/customers', customerRoutes);
router.use('/stores', storeRoutes);
router.use('/menu', menuItemRoutes);
router.use('/orders', orderRoutes);
router.use('/drivers', driverRoutes);
router.use('/driver-requests', driverRequestRoutes);
router.use('/tracking', trackingRoutes);

module.exports = router;