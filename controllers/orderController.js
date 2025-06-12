const { Order, OrderItem, Store, User, Driver, DriverRequest, DriverReview, OrderReview, MenuItem, sequelize } = require('../models');
const { getQueryOptions } = require('../utils/queryHelper');
const response = require('../utils/response');
const euclideanDistance = require('../utils/euclideanDistance');
const { logger } = require('../utils/logger');
// Queue functionality moved to worker.js
const { Op } = require('sequelize');

// Fungsi untuk membatalkan order
async function cancelOrder(id) {
    try {
        const order = await Order.findByPk(id);
        if (order && order.order_status === 'pending') {
            await order.update({
                order_status: 'cancelled',
                cancellationReason: 'Order dibatalkan'
            });
            console.log(`Order ${id} dibatalkan`);
        }
    } catch (error) {
        console.error('Gagal membatalkan order:', error);
    }
}

// cleanupQueue function removed - handled by worker.js now

// Fungsi pencarian driver di background
async function findDriverInBackground(storeId, orderId) {
    let timeout;
    let searchInterval;
    let jobCompleted = false;

    try {
        const store = await Store.findByPk(storeId);
        if (!store) {
            console.error(`Store ${storeId} not found`);
            await cancelOrder(orderId);
            // Cleanup now handled by worker system
            return;
        }

        // Set timeout 15 menit untuk pembatalan otomatis
        timeout = setTimeout(async () => {
            if (!jobCompleted) {
                jobCompleted = true;
                clearInterval(searchInterval);
                await cancelOrder(orderId);
                // Cleanup now handled by worker system
                logger.info(`Order ${orderId} dibatalkan karena timeout 15 menit`);
            }
        }, 15 * 60 * 1000); // 15 menit dalam milidetik

        const maxDistance = 5; // 5 km radius maksimal (dalam Euclidean distance)

        // Fungsi untuk mencari driver
        const searchForDriver = async () => {
            if (jobCompleted) return;

            try {
                // Cek apakah sudah ada driver yang menerima order ini
                const existingAcceptedRequest = await DriverRequest.findOne({
                    where: {
                        orderId: orderId,
                        status: 'accepted'
                    }
                });

                if (existingAcceptedRequest) {
                    // Jika sudah ada driver yang menerima, hentikan pencarian
                    jobCompleted = true;
                    clearTimeout(timeout);
                    clearInterval(searchInterval);
                    logger.info(`Order ${orderId} sudah memiliki driver (${existingAcceptedRequest.driverId}) yang menerima`);
                    return;
                }

                // Dapatkan semua driver yang available dan belum menolak order ini
                const drivers = await Driver.findAll({
                    where: {
                        latitude: { [Op.not]: null },
                        longitude: { [Op.not]: null },
                        status: 'active',
                    },
                    include: [
                        {
                            model: User,
                            as: 'user',
                            attributes: ['id'],
                            required: true // Optional, depending on whether Driver must have a User
                        },
                        {
                            model: DriverRequest,
                            as: 'driverRequests',
                            where: {
                                orderId: orderId,
                                status: { [Op.ne]: 'rejected' }
                            },
                            required: false
                        }
                    ]
                });

                let nearestDriver = null;
                let minDistance = Infinity;

                // Filter driver yang berada dalam radius 5 km menggunakan Euclidean distance
                drivers.forEach((driver) => {
                    if (!driver.latitude || !driver.longitude) return;

                    // Skip driver yang sudah menolak order ini
                    if (driver.driverRequests &&
                        driver.driverRequests.some(req => req.status === 'rejected' && req.orderId === orderId)) {
                        return;
                    }

                    const distance = euclideanDistance(
                        store.latitude,
                        store.longitude,
                        driver.latitude,
                        driver.longitude
                    );

                    // Hanya pertimbangkan driver dalam radius 5 km
                    if (distance <= maxDistance && distance < minDistance) {
                        minDistance = distance;
                        nearestDriver = driver;
                    }
                });

                if (nearestDriver) {
                    // Cek apakah sudah ada request pending untuk driver ini
                    const existingRequest = await DriverRequest.findOne({
                        where: {
                            orderId: orderId,
                            driverId: nearestDriver.id,
                            status: 'pending'
                        }
                    });

                    if (!existingRequest) {
                        // Buat driver request baru jika belum ada
                        const driverRequest = await DriverRequest.create({
                            orderId: orderId,
                            driverId: nearestDriver.id,
                            status: 'pending'
                        });

                        // Schedule timeout untuk driver request menggunakan worker
                        try {
                            const { workerManager } = require('../worker');
                            await workerManager.scheduleDriverRequestTimeout(driverRequest.id, 15);
                            logger.info(`Timeout scheduled for driver request ${driverRequest.id}`);
                        } catch (workerError) {
                            logger.error('Error scheduling driver request timeout:', {
                                requestId: driverRequest.id,
                                error: workerError.message
                            });
                        }

                        logger.info(`Driver request created for order ${orderId} with driver ${nearestDriver.id}`);
                        logger.info(`Driver ${nearestDriver.id} ditemukan untuk order ${orderId} pada jarak ${minDistance.toFixed(2)} km (Euclidean)`);
                    }
                } else {
                    logger.info(`Tidak menemukan driver yang tersedia dalam radius ${maxDistance} km untuk order ${orderId}`);
                }
            } catch (error) {
                logger.error(`Error dalam pencarian driver untuk order ${orderId}:`, error);
            }
        };

        // Jalankan pencarian segera
        await searchForDriver();

        // Set interval pencarian setiap 30 detik
        searchInterval = setInterval(searchForDriver, 30000);

    } catch (error) {
        logger.error('Error in findDriverInBackground:', error);
        if (!jobCompleted) {
            jobCompleted = true;
            clearTimeout(timeout);
            clearInterval(searchInterval);
            await cancelOrder(orderId);
            // Cleanup now handled by worker system
        }
    }
}

const getStoreByUserId = async (userId) => {
    return await Store.findOne({ where: { userId } });
};

/**
 * Menghitung estimasi waktu pengiriman menggunakan jarak yang sudah ada di tabel store
 * @param {number} distance - Jarak yang sudah disimpan di database (dalam km)
 * @returns {number} - Estimasi waktu dalam menit
 */
const calculateEstimatedDeliveryTime = (distance) => {
    const averageSpeed = 30; // Asumsi kecepatan rata-rata 40 km/jam
    const estimatedTime = (distance / averageSpeed) * 60; // Konversi ke menit
    return Math.round(estimatedTime);
};

/**
 * Mendapatkan order berdasarkan user yang sedang login (customer).
 */
const getOrdersByUser = async (req, res) => {
    try {
        const queryOptions = getQueryOptions(req.query);
        const customerId = req.user.id;

        if (!customerId) {
            return response(res, {
                statusCode: 400,
                message: 'User ID tidak ditemukan',
            });
        }

        queryOptions.where = { customerId };

        const { count, rows: orders } = await Order.findAndCountAll(queryOptions);

        return response(res, {
            statusCode: 200,
            message: 'Berhasil mendapatkan data order',
            data: {
                totalItems: count,
                totalPages: Math.ceil(count / queryOptions.limit),
                currentPage: parseInt(req.query.page) || 1,
                orders
            },
        });
    } catch (error) {
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat mengambil data order',
            errors: error.message,
        });
    }
};

/**
 * Mendapatkan order berdasarkan store yang dimiliki oleh owner yang sedang login.
 */
const getOrdersByStore = async (req, res) => {
    try {
        const queryOptions = getQueryOptions(req.query);
        const store = await getStoreByUserId(req.user.id);
        if (!store) {
            return response(res, { statusCode: 404, message: 'Toko tidak ditemukan untuk user ini' });
        }

        queryOptions.where = { storeId: store.id };

        const { count, rows: orders } = await Order.findAndCountAll(queryOptions);

        return response(res, {
            statusCode: 200,
            message: 'Berhasil mendapatkan data order',
            data: {
                totalItems: count,
                totalPages: Math.ceil(count / queryOptions.limit),
                currentPage: parseInt(req.query.page) || 1,
                orders
            }
        });
    } catch (error) {
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat mengambil data order',
            errors: error.message,
        });
    }
};

/**
 * Membuat order baru dengan request body sederhana (hanya items id)
 */
const placeOrder = async (req, res) => {
    let transaction;
    try {
        transaction = await sequelize.transaction();

        const { notes, items: requestedItems, storeId } = req.body;
        const { id: customerId } = req.user;

        if (!requestedItems?.length) {
            await transaction.rollback();
            return response(res, { statusCode: 400, message: 'Items harus diisi' });
        }

        if (!Number.isInteger(storeId)) {
            await transaction.rollback();
            return response(res, { statusCode: 400, message: 'Store ID harus berupa angka' });
        }

        const [store, menuItems] = await Promise.all([
            Store.findByPk(storeId, { transaction }),
            MenuItem.findAll({
                where: {
                    id: requestedItems.map(item => item.itemId),
                    storeId
                },
                transaction
            })
        ]);

        if (!store) {
            await transaction.rollback();
            return response(res, { statusCode: 404, message: 'Toko tidak ditemukan' });
        }

        if (menuItems.length !== requestedItems.length) {
            const missingItems = requestedItems
                .filter(item => !menuItems.some(mi => mi.id === item.itemId))
                .map(item => item.itemId);
            await transaction.rollback();
            return response(res, {
                statusCode: 400,
                message: `Menu item dengan ID ${missingItems.join(', ')} tidak ditemukan`
            });
        }

        const orderItems = menuItems.map(menuItem => {
            const reqItem = requestedItems.find(item => item.itemId === menuItem.id);
            return {
                name: menuItem.name,
                price: menuItem.price,
                quantity: reqItem.quantity || 1,
                imageUrl: menuItem.imageUrl
            };
        });

        const subtotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const serviceCharge = subtotal * 0.1;
        const total = subtotal + serviceCharge;

        const order = await Order.create({
            code: `ORD-${Date.now()}`,
            deliveryAddress: "Institut Teknologi Del",
            subtotal,
            serviceCharge,
            total,
            orderDate: new Date(),
            notes: notes || null,
            customerId,
            storeId,
            order_status: 'pending', // Status awal
        }, { transaction });

        const orderCode = order.code;
        const orderResult = await Order.findOne({
            where: { code: orderCode },
            transaction
        });

        if (!orderResult?.id) {
            await transaction.rollback();
            throw new Error('Gagal mendapatkan ID order');
        }

        const orderItemsData = orderItems.map(item => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity || 1,
            imageUrl: item.imageUrl || null,
            orderId: orderResult.id,
        }));

        await OrderItem.bulkCreate(orderItemsData, { transaction });

        await transaction.commit();

        // Driver search now handled automatically by findDriverInBackground
        await findDriverInBackground(store.id, orderResult.id);

        return response(res, {
            statusCode: 201,
            message: 'Order berhasil dibuat',
            data: orderResult
        });

    } catch (error) {
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }

        logger.error('Order creation failed:', error);
        return response(res, { statusCode: 500, message: 'Terjadi kesalahan saat membuat order', data: null, errors: error.message });
    }
};

/**
 * Approve atau reject order oleh toko.
 */
const processOrderByStore = async (req, res) => {
    try {
        const { id } = req.params;
        const { action } = req.body; // 'approve' atau 'reject'
        const { id: userId } = req.user;

        // Validasi action
        if (!['approve', 'reject'].includes(action)) {
            return response(res, {
                statusCode: 400,
                message: 'Action harus berupa "approve" atau "reject"'
            });
        }

        // Cek apakah user adalah pemilik toko
        const store = await Store.findOne({ where: { userId } });
        if (!store) {
            return response(res, { statusCode: 403, message: 'Hanya pemilik toko yang dapat memproses order' });
        }

        const order = await Order.findOne({
            where: { id: id, storeId: store.id },
            include: [
                { model: Store, as: 'store' },
                { model: User, as: 'customer' },
            ],
        });

        if (!order) {
            return response(res, { statusCode: 404, message: 'Order tidak ditemukan' });
        }

        if (order.order_status !== 'pending') {
            return response(res, {
                statusCode: 400,
                message: `Order tidak bisa diproses karena status saat ini adalah ${order.order_status}`
            });
        }

        if (action === 'approve') {
            const estimatedDeliveryTime = calculateEstimatedDeliveryTime(order.store.distance);

            await order.update({
                order_status: 'preparing',
                estimatedDeliveryTime,
            });

            return response(res, {
                statusCode: 200,
                message: 'Order berhasil disetujui. Status order sekarang: preparing.',
                data: order,
            });
        } else { // action === 'reject'
            await order.update({
                order_status: 'cancelled',
                cancellationReason: 'Ditolak oleh toko'
            });

            // Queue cleanup now handled by worker system

            return response(res, {
                statusCode: 200,
                message: 'Order berhasil ditolak. Status order sekarang: cancelled.',
                data: order,
            });
        }
    } catch (error) {
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat memproses order',
            errors: error.message,
        });
    }
};

/**
 * Mendapatkan detail order berdasarkan ID.
 */
const getOrderDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const order = await Order.findOne({
            where: { id: id },
            include: [
                { model: OrderItem, as: 'items' },
                { model: Store, as: 'store' },
                { model: User, as: 'customer' },
                { model: User, as: 'driver' },
                { model: OrderReview, as: 'orderReviews' },
                { model: DriverReview, as: 'driverReviews' },
            ],
        });

        if (!order) {
            return response(res, { statusCode: 404, message: 'Order tidak ditemukan' });
        }

        return response(res, {
            statusCode: 200,
            message: 'Berhasil mendapatkan detail order',
            data: order,
        });
    } catch (error) {
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat mengambil detail order',
            errors: error.message,
        });
    }
};

/**
 * Mengupdate status order berdasarkan ID.
 */
const updateOrderStatus = async (req, res) => {
    try {
        logger.info('Update order status request:', { orderId: req.params.id, status: req.body.status });
        const { id } = req.params;
        const { status } = req.body;

        const order = await Order.findByPk(id);
        if (!order) {
            logger.warn('Order not found for status update:', { orderId: id });
            return response(res, { statusCode: 404, message: 'Order tidak ditemukan' });
        }

        await order.update({ status });

        logger.info('Order status updated successfully:', { orderId: order.id, status });
        return response(res, {
            statusCode: 200,
            message: 'Status order berhasil diupdate',
            data: order,
        });
    } catch (error) {
        logger.error('Error updating order status:', { error: error.message, stack: error.stack });
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat mengupdate status order',
            errors: error.message,
        });
    }
};

/**
 * Cancel order.
 */
const cancelOrderRequest = async (req, res) => {
    try {
        const { id } = req.params;

        const order = await Order.findByPk(id);
        if (!order) {
            return response(res, { statusCode: 404, message: 'Order tidak ditemukan' });
        }

        await order.update({ order_status: 'cancelled' });  // Update status order menjadi 'cancelled'

        return response(res, {
            statusCode: 200,
            message: 'Order berhasil dibatalkan',
            data: order,
        });

    } catch (error) {
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat membatalkan order',
            errors: error.message,
        });
    }
}

/**
 * Membuat review untuk store atau driver.
 */
const createReview = async (req, res) => {
    try {
        const { id: userId } = req.user;
        const { orderId, store, driver } = req.body;

        // Cek apakah order sudah selesai.
        const order = await Order.findOne({
            where: { id: orderId, order_status: 'delivered' },
        });
        if (!order) {
            return response(res, {
                statusCode: 400,
                message: 'Hanya order dengan status delivered yang bisa direview'
            });
        }

        // Cek apakah review sudah ada untuk order ini.
        const existingOrderReview = await OrderReview.findOne({
            where: { orderId, userId },
        });

        if (existingOrderReview) {
            return response(res, {
                statusCode: 400,
                message: 'Anda sudah memberikan review untuk order ini'
            });
        }

        // Review untuk store.
        if (store?.rating && order.storeId) {
            await OrderReview.create({
                orderId,
                userId,
                rating: store.rating,
                comment: store.comment || null,
            });

            const storeData = await Store.findByPk(order.storeId);
            if (storeData) {
                const totalRating = storeData.rating * storeData.reviewCount + store.rating;
                const newReviewCount = storeData.reviewCount + 1;
                const newRating = totalRating / newReviewCount;

                await storeData.update({
                    rating: newRating,
                    reviewCount: newReviewCount,
                });
            }
        }

        // Review untuk driver.
        if (driver?.rating && order.driverId) {
            await DriverReview.create({
                driverId: order.driverId,
                userId,
                rating: driver.rating,
                comment: driver.comment || null,
            });

            const driverData = await Driver.findByPk(order.driverId);
            if (driverData) {
                const totalRating = driverData.rating * driverData.reviews_count + driver.rating;
                const newReviewsCount = driverData.reviews_count + 1;
                const newRating = totalRating / newReviewsCount;

                await driverData.update({
                    rating: newRating,
                    reviews_count: newReviewsCount,
                });
            }
        }

        return response(res, {
            statusCode: 201,
            message: 'Review berhasil dibuat',
        });
    } catch (error) {
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat membuat review',
            errors: error.message,
        });
    }
};

module.exports = {
    findDriverInBackground,
    getOrdersByUser,
    getOrdersByStore,
    placeOrder,
    cancelOrder,
    processOrderByStore,
    getOrderDetail,
    updateOrderStatus,
    cancelOrderRequest,
    createReview
};