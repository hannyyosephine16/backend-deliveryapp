'use strict';

const express = require('express');
const router = express.Router();
const { protect } = require('../../middleware/auth');
const { validate } = require('../../middleware/validator');
const schemas = require('../../validations/schemas');
const {
    getAllLocations,
    getPopularLocations,
    searchLocations,
    getServiceFee,
    getLocationById
} = require('../../controllers/masterLocationController');

/**
 * @swagger
 * /locations:
 *   get:
 *     summary: Get all active locations
 *     tags: [Master Locations]
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
 *         name: popular_only
 *         schema:
 *           type: boolean
 *         description: Show only popular locations
 *       - in: query
 *         name: service_type
 *         schema:
 *           type: string
 *           enum: [delivery, transport, courier, other]
 *         description: Filter by service type
 *       - in: query
 *         name: region
 *         schema:
 *           type: string
 *         description: Filter by region
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         description: Filter by city
 *     responses:
 *       200:
 *         description: List of locations
 */
router.get('/', protect, getAllLocations);

/**
 * @swagger
 * /locations/popular:
 *   get:
 *     summary: Get popular locations
 *     tags: [Master Locations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of popular locations
 */
router.get('/popular', protect, getPopularLocations);

/**
 * @swagger
 * /locations/search:
 *   get:
 *     summary: Search locations by name or address
 *     tags: [Master Locations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query (minimum 2 characters)
 *       - in: query
 *         name: service_type
 *         schema:
 *           type: string
 *           enum: [delivery, transport, courier, other]
 *         description: Filter by service type
 *     responses:
 *       200:
 *         description: Search results
 *       400:
 *         description: Invalid search query
 */
router.get('/search', protect, validate(schemas.masterLocation.search), searchLocations);

/**
 * @swagger
 * /locations/service-fee:
 *   get:
 *     summary: Get service fee for pickup location (destinasi tetap ke IT Del)
 *     tags: [Master Locations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: pickup_location_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Pickup location ID
 *     responses:
 *       200:
 *         description: Service fee for location
 *       400:
 *         description: Invalid parameters
 *       404:
 *         description: Location not found
 */
router.get('/service-fee', protect, validate(schemas.masterLocation.serviceFee), getServiceFee);



/**
 * @swagger
 * /locations/{id}:
 *   get:
 *     summary: Get location by ID
 *     tags: [Master Locations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Location ID
 *     responses:
 *       200:
 *         description: Location details
 *       404:
 *         description: Location not found
 */
router.get('/:id', protect, getLocationById);

module.exports = router; 