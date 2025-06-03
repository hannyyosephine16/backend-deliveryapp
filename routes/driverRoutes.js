const express = require('express');
const { verifyToken, isAdmin, isDriver } = require('../middlewares/authMiddleware');
const {
    getAllDrivers,
    getDriverById,
    createDriver,
    updateDriver,
    deleteDriver,
    updateDriverLocation,
    getDriverLocation,
    updateDriverStatus,
    updateProfileDriver,
    getDriverOrders,
} = require('../controllers/driverController');
const {
    createDriverValidator,
    updateDriverValidator,
    deleteDriverValidator,
    validate,
} = require('../validators/driverValidator');
const router = express.Router();

// Driver routes
router.put('/location', verifyToken, isDriver, updateDriverLocation); // Hanya driver
router.put('/status', verifyToken, isDriver, updateDriverStatus); // Hanya driver
router.put('/update', verifyToken, isDriver, updateProfileDriver); // Hanya driver
router.get('/orders', verifyToken, isDriver, getDriverOrders); // Driver orders
router.get('/:driverId/location', verifyToken, getDriverLocation); // New route for driver location

// Admin routes
router.get('/', verifyToken, getAllDrivers);
router.get('/:id', verifyToken, getDriverById); // Hanya admin
router.post('/', verifyToken, isAdmin, createDriverValidator, validate, createDriver); // Hanya admin
router.put('/:id', verifyToken, isAdmin, updateDriverValidator, validate, updateDriver); // Hanya admin
router.delete('/:id', verifyToken, isAdmin, deleteDriverValidator, validate, deleteDriver); // Hanya admin

module.exports = router;