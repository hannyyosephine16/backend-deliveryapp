const { DriverRequest, Driver, DriverReview, Order, User, Store, OrderItem } = require('../models');
const response = require('../utils/response');
const logger = require('../utils/logger');
const { getQueryOptions } = require('../utils/queryHelper');
const { Op } = require('sequelize');

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
                        as: 'customer', // Assuming you have a user association in Order
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
        const { action } = req.body; // 'accept' atau 'reject'

        // Validasi input
        if (!['accept', 'reject'].includes(action)) {
            return response(res, {
                statusCode: 400,
                message: 'Action harus berupa "accept" atau "reject"'
            });
        }

        // Cari permintaan pengantaran
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

        // Jika request sudah diproses sebelumnya
        if (driverRequest.status !== 'pending') {
            return response(res, {
                statusCode: 400,
                message: `Permintaan pengantaran sudah di-${driverRequest.status} sebelumnya`
            });
        }

        // Update status permintaan berdasarkan action
        const newStatus = action === 'accept' ? 'accepted' : 'rejected';
        await driverRequest.update({ status: newStatus });

        // Jika diterima, update order
        if (action === 'accept') {
            // Pastikan order belum diambil driver lain
            const existingAcceptedRequest = await DriverRequest.findOne({
                where: {
                    id: { [Op.ne]: driverRequest.id },
                    orderId: driverRequest.orderId,
                    status: 'accepted'
                }
            });

            if (existingAcceptedRequest) {
                // Rollback our acceptance
                await driverRequest.update({ status: 'pending' });
                return response(res, {
                    statusCode: 400,
                    message: 'Order sudah diambil oleh driver lain'
                });
            }

            // Update status order
            await Order.update(
                {
                    driverId,
                    delivery_status: 'picking_up'
                },
                { where: { id: driverRequest.orderId } }
            );

            // Update semua request lain untuk order ini menjadi expired
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

        // Get updated request with relations
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
            message: action === 'accept'
                ? 'Permintaan pengantaran berhasil disetujui'
                : 'Permintaan pengantaran berhasil ditolak',
            data: updatedRequest
        });
    } catch (error) {
        logger.error('Gagal merespon permintaan pengantaran:', error);
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat memproses permintaan pengantaran',
            error: error.message,
        });
    }
};

module.exports = {
    getDriverRequests,
    getDriverRequestDetail,
    respondToDriverRequest
};