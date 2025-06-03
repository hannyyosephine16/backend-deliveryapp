const express = require('express');
const router = express.Router();
const {
    verifyToken,
    isCustomer,
    isOwner,
    isAdmin
} = require('../middlewares/authMiddleware');
const {
    getOrdersByUser,
    getOrdersByStore,
    placeOrder,
    processOrderByStore,
    getOrderDetail,
    updateOrderStatus,
    cancelOrderRequest,
    createReview
} = require('../controllers/orderController');
const {
    placeOrderValidator,
    validate
} = require('../validators/orderValidator');
const {
    createReviewValidator
} = require('../validators/reviewValidator');

// Customer routes
router.get('/user', verifyToken, isCustomer, getOrdersByUser);
router.post('/', verifyToken, isCustomer, placeOrderValidator, validate, placeOrder);
router.put('/:id/cancel', verifyToken, isCustomer, cancelOrderRequest);
router.post('/review', verifyToken, isCustomer, createReviewValidator, validate, createReview);

// Store owner routes
router.get('/store', verifyToken, isOwner, getOrdersByStore);
router.put('/:id/process', verifyToken, isOwner, processOrderByStore);

// Admin routes
router.put('/status', verifyToken, isAdmin, validate, updateOrderStatus);

// General routes (accessible by all authenticated users)
router.get('/:id', verifyToken, getOrderDetail);

module.exports = router;