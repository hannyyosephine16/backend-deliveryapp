const { DriverRequest, Driver, DriverReview, Order, User, Store, OrderItem } = require('../models');
const response = require('../utils/response');
const { logger } = require('../utils/logger');
const { getQueryOptions } = require('../utils/queryHelper');
const { Op } = require('sequelize');

// Background job functions moved to utils/backgroundJobs.js

const getDriverRequests = async (req, res) => {
    try {
        logger.info('Get driver requests request:', { userId: req.user.id });
        const queryOptions = getQueryOptions(req.query);

        const userId = req.user.id;

        const driver = await Driver.findOne({
            where: { userId }
        });

        if (!driver) {
            logger.warn('Driver not found:', { userId });
            return response(res, {
                statusCode: 404,
                message: 'Driver tidak ditemukan'
            });
        }

        const driverId = driver.id;

        queryOptions.where = { driverId };

        queryOptions.include = [
            {
                model: Order,
                as: 'order',
                include: [
                    {
                        model: User,
                        as: 'customer',
                        attributes: ['id', 'name', 'phone']
                    }
                ]
            }
        ];

        queryOptions.order = [['createdAt', 'DESC']];

        const { count, rows: requests } = await DriverRequest.findAndCountAll(queryOptions);

        logger.info('Successfully retrieved driver requests:', { driverId, count });
        return response(res, {
            statusCode: 200,
            message: 'Berhasil mendapatkan permintaan pengantaran',
            data: {
                totalItems: count,
                totalPages: Math.ceil(count / queryOptions.limit),
                currentPage: parseInt(req.query.page) || 1,
                requests
            }
        });
    } catch (error) {
        logger.error('Error getting driver requests:', { error: error.message, stack: error.stack });
        return response(res, {
            statusCode: 500,
            message: 'Gagal mendapatkan permintaan pengantaran',
            error: error.message
        });
    }
};

/**
 * Get detailed driver request
 */
const getDriverRequestDetail = async (req, res) => {
    try {
        logger.info('Get driver request detail request:', { userId: req.user.id, requestId: req.params.requestId });
        const userId = req.user.id;

        const driver = await Driver.findOne({
            where: { userId }
        });

        if (!driver) {
            logger.warn('Driver not found:', { userId });
            return response(res, {
                statusCode: 404,
                message: 'Driver tidak ditemukan'
            });
        }

        const driverId = driver.id;
        const { requestId } = req.params;

        const driverRequest = await DriverRequest.findOne({
            where: {
                id: requestId,
                driverId
            },
            include: [
                {
                    model: Order,
                    as: 'order',
                    include: [
                        {
                            model: User,
                            as: 'customer',
                            attributes: ['id', 'name', 'phone', 'address']
                        },
                        {
                            model: Store,
                            as: 'store',
                            attributes: ['id', 'name', 'address', 'phone']
                        },
                        {
                            model: OrderItem,
                            as: 'items',
                        },
                        {
                            model: DriverReview,
                            as: 'driverReviews',
                        }
                    ]
                }
            ]
        });

        if (!driverRequest) {
            logger.warn('Driver request not found:', { requestId, driverId });
            return response(res, {
                statusCode: 404,
                message: 'Permintaan pengantaran tidak ditemukan'
            });
        }

        logger.info('Successfully retrieved driver request detail:', { requestId });
        return response(res, {
            statusCode: 200,
            message: 'Berhasil mendapatkan detail permintaan pengantaran',
            data: driverRequest
        });
    } catch (error) {
        logger.error('Error getting driver request detail:', { error: error.message, stack: error.stack });
        return response(res, {
            statusCode: 500,
            message: 'Gagal mendapatkan detail permintaan pengantaran',
            error: error.message
        });
    }
};

/**
 * Driver merespon permintaan pengantaran (menerima/menolak)
 */
const respondToDriverRequest = async (req, res) => {
    try {
        logger.info('Respond to driver request:', { userId: req.user.id, requestId: req.params.requestId, action: req.body.action });
        const userId = req.user.id;
        const driver = await Driver.findOne({
            where: { userId }
        });

        if (!driver) {
            logger.warn('Driver not found:', { userId });
            return response(res, {
                statusCode: 404,
                message: 'Driver tidak ditemukan'
            });
        }

        const driverId = driver.id;
        const { requestId } = req.params;
        const { action } = req.body;

        if (!['accept', 'reject'].includes(action)) {
            logger.warn('Invalid action:', { action });
            return response(res, {
                statusCode: 400,
                message: 'Action harus berupa "accept" atau "reject"'
            });
        }

        const driverRequest = await DriverRequest.findOne({
            where: {
                id: requestId,
                driverId
            },
            include: [{
                model: Order,
                as: 'order'
            }]
        });

        if (!driverRequest) {
            logger.warn('Driver request not found:', { requestId, driverId });
            return response(res, {
                statusCode: 404,
                message: 'Permintaan pengantaran tidak ditemukan'
            });
        }

        if (driverRequest.status !== 'pending') {
            return response(res, {
                statusCode: 400,
                message: `Permintaan pengantaran sudah di-${driverRequest.status} sebelumnya`
            });
        }

        const newStatus = action === 'accept' ? 'accepted' : 'rejected';
        await driverRequest.update({ status: newStatus });

        if (action === 'accept') {
            // Check if order is already taken
            const existingAcceptedRequest = await DriverRequest.findOne({
                where: {
                    id: { [Op.ne]: driverRequest.id },
                    orderId: driverRequest.orderId,
                    status: 'accepted'
                }
            });

            if (existingAcceptedRequest) {
                await driverRequest.update({ status: 'pending' });
                return response(res, {
                    statusCode: 400,
                    message: 'Order sudah diambil oleh driver lain'
                });
            }

            // Update driver status to busy
            await driver.update({ status: 'busy' });

            // Update order status
            await Order.update(
                {
                    driverId,
                    delivery_status: 'picking_up'
                },
                { where: { id: driverRequest.orderId } }
            );

            // Update other requests to expired
            await DriverRequest.update(
                { status: 'expired' },
                {
                    where: {
                        id: { [Op.ne]: driverRequest.id },
                        orderId: driverRequest.orderId,
                        status: 'pending'
                    }
                }
            );
        }

        const updatedRequest = await DriverRequest.findOne({
            where: { id: driverRequest.id },
            include: [
                {
                    model: Order,
                    as: 'order',
                    include: [
                        {
                            model: User,
                            as: 'customer',
                            attributes: ['id', 'name', 'phone']
                        }
                    ]
                }
            ]
        });

        logger.info('Successfully responded to driver request:', { requestId, action });
        return response(res, {
            statusCode: 200,
            message: `Permintaan pengantaran berhasil ${action === 'accept' ? 'diterima' : 'ditolak'}`,
            data: updatedRequest
        });
    } catch (error) {
        logger.error('Error responding to driver request:', { error: error.message, stack: error.stack });
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat merespon permintaan pengantaran',
            error: error.message
        });
    }
};

module.exports = {
    getDriverRequests,
    getDriverRequestDetail,
    respondToDriverRequest
};