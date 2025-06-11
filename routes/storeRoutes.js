const express = require('express');
const { verifyToken, isAdmin, isOwner } = require('../middlewares/authMiddleware');
const {
    getAllStores,
    getStoreById,
    createStore,
    updateStore,
    deleteStore,
    updateProfileStore,
    updateStoreStatus
} = require('../controllers/storeController');

const {
    createStoreValidator,
    updateStoreValidator,
    deleteStoreValidator,
    validate,
} = require('../validators/storeValidator');

const router = express.Router();

// Store routes
router.put('/update', verifyToken, updateProfileStore);
router.patch(
    '/:id/status',
    verifyToken,
    isOwner,
    updateStoreStatus
);
router.get('/', getAllStores); // Semua role
router.get('/:id', getStoreById); // Semua role
router.post('/', verifyToken, isAdmin, createStoreValidator, validate, createStore); // Hanya admin
router.put('/:id', verifyToken, isAdmin, updateStoreValidator, validate, updateStore); // Hanya admin
router.delete('/:id', verifyToken, isAdmin, deleteStoreValidator, validate, deleteStore); // Hanya admin

module.exports = router;