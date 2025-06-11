const { DriverRequest, Driver, DriverReview, Order, User, Store, OrderItem } = require('../models');
const response = require('../utils/response');
const logger = require('../utils/logger');
const { getQueryOptions } = require('../utils/queryHelper');
const { Op } = require('sequelize');

// Function to handle request timeouts
const handleRequestTimeout = async (driverRequest) => {
    try {
        // Update the expired request
        await driverRequest.update({ status: 'expired' });

        // Find other available drivers
        const availableDrivers = await Driver.findAll({
            where: {
                status: 'active',
                id: { [Op.ne]: driverRequest.driverId }
            }
        });

        if (availableDrivers.length > 0) {
            // Create new requests for other drivers
            const newRequests = availableDrivers.map(driver => ({
                orderId: driverRequest.orderId,
                driverId: driver.id,
                status: 'pending'
            }));

            await DriverRequest.bulkCreate(newRequests);
            logger.info(`Reassigned order ${driverRequest.orderId} to ${newRequests.length} new drivers`);
        } else {
            // If no drivers available, mark order as failed
            await Order.update(
                { order_status: 'cancelled', cancellationReason: 'No available drivers' },
                { where: { id: driverRequest.orderId } }
            );
            logger.info(`Order ${driverRequest.orderId} marked as failed - no available drivers`);
        }
    } catch (error) {
        logger.error('Error handling request timeout:', error);
    }
};

// Function to check for expired requests
const checkExpiredRequests = async () => {
    try {
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

        const expiredRequests = await DriverRequest.findAll({
            where: {
                status: 'pending',
                createdAt: { [Op.lt]: fifteenMinutesAgo }
            },
            include: [{
                model: Order,
                as: 'order'
            }]
        });

        for (const request of expiredRequests) {
            await handleRequestTimeout(request);
        }
    } catch (error) {
        logger.error('Error checking expired requests:', error);
    }
};

// Run the check every minute
setInterval(checkExpiredRequests, 60 * 1000);

const getDriverRequests = async (req, res) => {
    try {
        const queryOptions = getQueryOptions(req.query);

        const userId = req.user.id; // Get the logged-in driver's ID from the token

        const driver = await Driver.findOne({
            where: { userId }
        });

        if (!driver) {
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
        logger.error('Gagal mendapatkan permintaan pengantaran:', error);
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
        const userId = req.user.id; // Get the logged-in driver's ID from the token

        const driver = await Driver.findOne({
            where: { userId }
        });

        if (!driver) {
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
                            as: 'user',
                            attributes: ['id', 'name', 'phone', 'address']
                        },
                        {
                            model: Store,
                            as: 'store',
                            attributes: ['id', 'name', 'address', 'phone']
                        },
                        {
                            model: OrderItem,
                            as: 'orderItems',
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
            return response(res, {
                statusCode: 404,
                message: 'Permintaan pengantaran tidak ditemukan'
            });
        }

        return response(res, {
            statusCode: 200,
            message: 'Berhasil mendapatkan detail permintaan pengantaran',
            data: driverRequest
        });
    } catch (error) {
        logger.error('Gagal mendapatkan detail permintaan pengantaran:', error);
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
        const userId = req.user.id;
        const driver = await Driver.findOne({
            where: { userId }
        });

        if (!driver) {
            return response(res, {
                statusCode: 404,
                message: 'Driver tidak ditemukan'
            });
        }

        const driverId = driver.id;
        const { requestId } = req.params;
        const { action } = req.body;

        if (!['accept', 'reject'].includes(action)) {
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

        return response(res, {
            statusCode: 200,
            message: `Permintaan pengantaran berhasil di-${action}`,
            data: updatedRequest
        });
    } catch (error) {
        logger.error('Error in respondToDriverRequest:', error);
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat memproses permintaan pengantaran',
            errors: error.message
        });
    }
};

module.exports = {
    getDriverRequests,
    getDriverRequestDetail,
    respondToDriverRequest
};