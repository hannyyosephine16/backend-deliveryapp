const express = require('express');
const { verifyToken, isDriver } = require('../middlewares/authMiddleware');
const { getTrackingData, startDelivery, completeDelivery } = require('../controllers/trackingController');

const router = express.Router();

router.get('/:id', verifyToken, getTrackingData);
router.put('/:id/start', verifyToken, isDriver, startDelivery);
router.put('/:id/complete', verifyToken, isDriver, completeDelivery);

module.exports = router;