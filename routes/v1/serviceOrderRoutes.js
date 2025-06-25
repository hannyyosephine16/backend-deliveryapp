'use strict';

const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../../middleware/auth');
const { validate } = require('../../middleware/validator');
const schemas = require('../../validations/schemas');
const {
    createServiceOrder,
    getAvailableDriversForService,
    acceptServiceOrder,
    getServiceOrdersByCustomer,
    getServiceOrdersByDriver,
    updateServiceOrderStatus,
    createServiceOrderReview,
    getServiceOrderById,
    cancelServiceOrder
} = require('../../controllers/serviceOrderController');

/**
 * @swagger
 * /service-orders:
 *   post:
 *     summary: Create a new service order
 *     tags: [Service Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [service_type, pickup_address, pickup_latitude, pickup_longitude, destination_address, destination_latitude, destination_longitude, customer_phone]
 *             properties:
 *               service_type:
 *                 type: string
 *                 enum: [delivery, transport, courier, other]
 *               pickup_address:
 *                 type: string
 *               pickup_latitude:
 *                 type: number
 *               pickup_longitude:
 *                 type: number
 *               destination_address:
 *                 type: string
 *               destination_latitude:
 *                 type: number
 *               destination_longitude:
 *                 type: number
 *               description:
 *                 type: string
 *               customer_phone:
 *                 type: string
 *     responses:
 *       201:
 *         description: Service order created successfully
 *       400:
 *         description: Invalid input
 */
router.post('/', protect, restrictTo('customer'), validate(schemas.serviceOrder.create), createServiceOrder);

/**
 * @swagger
 * /service-orders/available-drivers:
 *   get:
 *     summary: Get available drivers for jasa titip
 *     tags: [Service Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: pickup_latitude
 *         required: true
 *         schema:
 *           type: number
 *         description: Pickup location latitude
 *       - in: query
 *         name: pickup_longitude
 *         required: true
 *         schema:
 *           type: number
 *         description: Pickup location longitude
 *       - in: query
 *         name: destination_address
 *         required: true
 *         schema:
 *           type: string
 *         description: Destination address
 *     responses:
 *       200:
 *         description: List of available drivers
 *       404:
 *         description: No drivers available
 */
router.get('/available-drivers', protect, restrictTo('customer'), getAvailableDriversForService);

/**
 * @swagger
 * /service-orders/accept:
 *   post:
 *     summary: Accept jasa titip order (by driver)
 *     tags: [Service Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customer_id, pickup_address, pickup_latitude, pickup_longitude, destination_address, destination_latitude, destination_longitude, customer_phone]
 *             properties:
 *               customer_id:
 *                 type: integer
 *               pickup_address:
 *                 type: string
 *               pickup_latitude:
 *                 type: number
 *               pickup_longitude:
 *                 type: number
 *               destination_address:
 *                 type: string
 *               destination_latitude:
 *                 type: number
 *               destination_longitude:
 *                 type: number
 *               description:
 *                 type: string
 *               customer_phone:
 *                 type: string
 *     responses:
 *       201:
 *         description: Jasa titip order accepted successfully
 *       400:
 *         description: Invalid input or driver not available
 *       404:
 *         description: Driver or customer not found
 */
router.post('/accept', protect, restrictTo('driver'), validate(schemas.serviceOrder.accept), acceptServiceOrder);

/**
 * @swagger
 * /service-orders/customer:
 *   get:
 *     summary: Get service orders for current customer
 *     tags: [Service Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, driver_found, in_progress, completed, cancelled]
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: List of customer service orders
 */
router.get('/customer', protect, restrictTo('customer'), getServiceOrdersByCustomer);

/**
 * @swagger
 * /service-orders/driver:
 *   get:
 *     summary: Get service orders for current driver
 *     tags: [Service Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of items per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [driver_found, in_progress, completed, cancelled]
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: List of driver service orders
 */
router.get('/driver', protect, restrictTo('driver'), getServiceOrdersByDriver);

/**
 * @swagger
 * /service-orders/{id}:
 *   get:
 *     summary: Get service order by ID
 *     tags: [Service Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Service order details
 *       404:
 *         description: Service order not found
 *       403:
 *         description: Access denied
 */
router.get('/:id', protect, getServiceOrderById);

/**
 * @swagger
 * /service-orders/{id}/status:
 *   put:
 *     summary: Update service order status (by driver)
 *     tags: [Service Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [in_progress, completed, cancelled]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Status updated successfully
 *       404:
 *         description: Service order not found
 */
router.put('/:id/status', protect, restrictTo('driver'), validate(schemas.serviceOrder.updateStatus), updateServiceOrderStatus);

/**
 * @swagger
 * /service-orders/{id}/cancel:
 *   post:
 *     summary: Cancel service order (by customer)
 *     tags: [Service Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Service order cancelled successfully
 *       404:
 *         description: Service order not found
 */
router.post('/:id/cancel', protect, restrictTo('customer'), cancelServiceOrder);

/**
 * @swagger
 * /service-orders/{id}/review:
 *   post:
 *     summary: Create review for service order
 *     tags: [Service Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rating]
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               comment:
 *                 type: string
 *               service_quality:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               punctuality:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               communication:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *     responses:
 *       201:
 *         description: Review created successfully
 *       400:
 *         description: Invalid input or review already exists
 *       404:
 *         description: Service order not found or not completed
 */
router.post('/:id/review', protect, restrictTo('customer'), validate(schemas.serviceOrder.review), createServiceOrderReview);

module.exports = router; 