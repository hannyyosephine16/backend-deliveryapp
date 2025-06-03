const express = require('express');
const { verifyToken, isDriver } = require('../middlewares/authMiddleware');
const {
    getDriverRequests,
    getDriverRequestDetail,
    respondToDriverRequest
} = require('../controllers/driverRequestController');

const router = express.Router();

// Get all requests for the logged-in driver
router.get('/', verifyToken, isDriver, getDriverRequests);

// Get detailed request
router.get('/:requestId', verifyToken, isDriver, getDriverRequestDetail);

// Respond to request
router.put('/:requestId/respond', verifyToken, isDriver, respondToDriverRequest);

module.exports = router;