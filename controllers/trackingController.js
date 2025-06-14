const { Driver, DriverRequest, Order, User } = require('../models');
const response = require('../utils/response');
const { logger } = require('../utils/logger');

/**
 * Mendapatkan data tracking (untuk dipanggil secara periodik oleh client)
 */
const getTrackingData = async (req, res) => {
    try {
        logger.info('Get tracking data request:', { orderId: req.params.id, userId: req.user.id });
        const { id } = req.params;
        const userId = req.user.id;

        // Cek apakah customer memiliki akses ke order ini
        const order = await Order.findOne({
            where: { id: id, customerId: userId },
            include: [
                {
                    model: Driver,
                    as: 'driver',
                    include: [{
                        model: User,
                        as: 'user',
                        attributes: ['name', 'phone']
                    }],
                },
                {
                    model: DriverRequest,
                    as: 'driverRequests',
                    where: { status: 'accepted' },
                    required: false
                }
            ],
        });

        if (!order) {
            logger.warn('Order not found for tracking:', { orderId: id, userId });
            return response(res, { statusCode: 404, message: 'Order tidak ditemukan' });
        }

        // Jika order memiliki driver
        if (order.driver) {
            logger.info('Tracking data retrieved successfully:', { orderId: order.id, hasDriver: true });
            return response(res, {
                statusCode: 200,
                message: 'Data tracking berhasil diambil',
                data: {
                    orderId: order.id,
                    status: order.order_status,
                    storeLocation: {
                        latitude: order.store.latitude,
                        longitude: order.store.longitude
                    },
                    driverLocation: {
                        latitude: order.driver.user.latitude,
                        longitude: order.driver.user.longitude
                    },
                    deliveryAddress: order.delivery_address,
                    estimatedDeliveryTime: order.estimated_delivery_time,
                    driver: {
                        id: order.driver.user.id,
                        name: order.driver.user.name,
                        phone: order.driver.user.phone,
                    }
                },
            });
        }

        // Jika order belum memiliki driver, cek status pencarian
        logger.info('Order has no driver yet:', { orderId: order.id });
        return response(res, {
            statusCode: 200,
            message: 'Sedang mencari driver',
            data: {
                orderId: order.id,
                status: order.order_status,
                message: 'Sedang dalam proses pencarian driver'
            }
        });
    } catch (error) {
        logger.error('Error getting tracking data:', { error: error.message, stack: error.stack });
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat mengambil data tracking',
            errors: error.message,
        });
    }
};

/**
 * Memulai pengantaran oleh driver
 */
const startDelivery = async (req, res) => {
    try {
        logger.info('Start delivery request:', { orderId: req.params.id, userId: req.user.id });
        const { id } = req.params;
        const userId = req.user.id;

        // Cek apakah driver memiliki akses
        const driver = await Driver.findOne({ where: { userId } });
        const driverId = driver.id;

        // Cek apakah order ada dan driver memiliki akses
        const order = await Order.findOne({
            where: { id, driverId },
            include: [
                {
                    model: DriverRequest,
                    as: 'driverRequests',
                    where: { status: 'accepted', driverId },
                    required: true
                }
            ]
        });

        if (!order) {
            logger.warn('Order not found or unauthorized:', { orderId: id, driverId });
            return response(res, {
                statusCode: 404,
                message: 'Order tidak ditemukan atau Anda tidak memiliki akses'
            });
        }

        // Cek apakah order dalam status yang sesuai untuk memulai pengantaran
        if (order.order_status !== 'preparing') {
            logger.warn('Invalid order status for delivery start:', { orderId: id, status: order.order_status });
            return response(res, {
                statusCode: 400,
                message: 'Order tidak dalam status yang dapat dimulai'
            });
        }

        // Update status order
        await Order.update(
            {
                order_status: 'on_delivery',
                delivery_status: 'on_delivery',
                started_at: new Date()
            },
            { where: { id } }
        );

        // Ambil data order yang telah diperbarui
        const updatedOrder = await Order.findByPk(id, {
            include: [
                { model: User, as: 'customer', attributes: ['name'] },
                { model: User, as: 'driver', attributes: ['name'] }
            ]
        });

        logger.info('Delivery started successfully:', { orderId: id, driverId });
        return response(res, {
            statusCode: 200,
            message: 'Pengantaran dimulai',
            data: {
                orderId: updatedOrder.id,
                status: updatedOrder.order_status,
                startedAt: updatedOrder.started_at
            }
        });
    } catch (error) {
        logger.error('Error starting delivery:', { error: error.message, stack: error.stack });
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat memulai pengantaran',
            errors: error.message
        });
    }
};

/**
 * Menyelesaikan pengantaran oleh driver
 */
const completeDelivery = async (req, res) => {
    try {
        logger.info('Complete delivery request:', { orderId: req.params.id, userId: req.user.id });
        const { id } = req.params;
        const userId = req.user.id;

        // Cek apakah driver memiliki akses ke order ini
        const driver = await Driver.findOne({ where: { userId } });
        const driverId = driver.id;

        // Cek apakah order ada dan driver memiliki akses
        const order = await Order.findOne({
            where: { id, driverId },
            include: [
                {
                    model: DriverRequest,
                    as: 'driverRequests',
                    where: { status: 'accepted', driverId },
                    required: true
                }
            ]
        });

        if (!order) {
            logger.warn('Order not found or unauthorized:', { orderId: id, driverId });
            return response(res, {
                statusCode: 404,
                message: 'Order tidak ditemukan atau Anda tidak memiliki akses'
            });
        }

        // Cek apakah order dalam status on_delivery
        if (order.order_status !== 'on_delivery') {
            logger.warn('Invalid order status for delivery completion:', { orderId: id, status: order.order_status });
            return response(res, {
                statusCode: 400,
                message: 'Order tidak dalam status pengantaran'
            });
        }

        // Update status order dan driver request
        await Order.update(
            {
                order_status: 'delivered',
                delivery_status: 'delivered',
                delivered_at: new Date()
            },
            { where: { id } }
        );

        await DriverRequest.update(
            { status: 'completed' },
            { where: { orderId: id, driverId, status: 'accepted' } }
        );

        // Set driver status back to active
        await driver.update({ status: 'active' });

        // Ambil data order yang telah diperbarui
        const updatedOrder = await Order.findByPk(id, {
            include: [
                { model: User, as: 'customer', attributes: ['name'] },
                { model: User, as: 'driver', attributes: ['name'] }
            ]
        });

        logger.info('Delivery completed successfully:', { orderId: id, driverId });
        return response(res, {
            statusCode: 200,
            message: 'Pengantaran berhasil diselesaikan',
            data: updatedOrder
        });
    } catch (error) {
        logger.error('Error completing delivery:', { error: error.message, stack: error.stack });
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat menyelesaikan pengantaran',
            errors: error.message
        });
    }
};

module.exports = {
    getTrackingData,
    startDelivery,
    completeDelivery
};