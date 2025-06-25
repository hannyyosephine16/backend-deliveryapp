'use strict';

const { ServiceOrder, User, Driver, DriverReview, MasterLocation, sequelize } = require('../models');
const { getQueryOptions } = require('../utils/queryHelper');
const response = require('../utils/response');
const { logger } = require('../utils/logger');
const { sendNotification } = require('../utils/notifications');
const euclideanDistance = require('../utils/euclideanDistance');
const { Op } = require('sequelize');

/**
 * Get service fee from pickup location (destinasi tetap ke IT Del)
 */
const getServiceFeeFromPickupLocation = async (pickup_address) => {
    try {
        // Cari lokasi pickup berdasarkan nama
        const pickupLocation = await MasterLocation.findOne({
            where: {
                is_active: true,
                name: { [Op.iLike]: `%${pickup_address}%` }
            }
        });

        if (pickupLocation) {
            return {
                service_fee: pickupLocation.getServiceFee(),
                estimated_duration: pickupLocation.getEstimatedDuration(),
                pickup_location: pickupLocation
            };
        }

        // Fallback jika lokasi tidak ditemukan
        return { service_fee: 20000, estimated_duration: 30 };
    } catch (error) {
        logger.error('Error getting service fee from pickup location:', error);
        return { service_fee: 20000, estimated_duration: 30 };
    }
};



/**
 * Create a new service order
 */
const createServiceOrder = async (req, res) => {
    let transaction;
    try {
        transaction = await sequelize.transaction();
        logger.info('Create service order request:', { customer_id: req.user.id });

        const {
            pickup_address,
            pickup_latitude,
            pickup_longitude,
            description,
            customer_phone
        } = req.body;

        // Get service fee berdasarkan pickup location (destinasi tetap IT Del)
        const feeCalculation = await getServiceFeeFromPickupLocation(pickup_address);
        const service_fee = feeCalculation.service_fee;
        const estimated_duration = feeCalculation.estimated_duration;

        // Create service order (destinasi tetap ke IT Del)
        const serviceOrderData = {
            customer_id: req.user.id,
            
            pickup_address,
            pickup_latitude,
            pickup_longitude,
            destination_address: 'IT Del',
            destination_latitude: 2.3834831864787818,
            destination_longitude: 99.14857915147614,
            description,
            service_fee,
            customer_phone,
            estimated_duration,
            status: 'pending'
        };

        // Add location references if found
        if (feeCalculation.pickup_location) {
            serviceOrderData.pickup_location_id = feeCalculation.pickup_location.id;
        }

        const serviceOrder = await ServiceOrder.create(serviceOrderData, { transaction });

        await transaction.commit();

        // Find available drivers in background
        findDriverInBackgroundForService(serviceOrder.id);

        logger.info('Service order created successfully:', { service_order_id: serviceOrder.id });
        return response(res, {
            statusCode: 201,
            message: 'Jasa titip berhasil dibuat. Mencari driver terdekat...',
            data: {
                ...serviceOrder.toJSON(),
                estimated_duration_text: `${estimated_duration} menit`
            }
        });
    } catch (error) {
        if (transaction) await transaction.rollback();
        logger.error('Error creating service order:', { error: error.message, stack: error.stack });
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat membuat jasa titip',
            errors: error.message
        });
    }
};

/**
 * Find driver for service order in background dengan metode yang sama seperti order controller
 */
const findDriverInBackgroundForService = async (serviceOrderId) => {
    let timeout;
    let searchInterval;
    let jobCompleted = false;
    let lastSearchTime = 0;
    const SEARCH_COOLDOWN = 30000; // 30 detik cooldown antara pencarian
    const MAX_RETRIES = 30; // Maksimal 30 kali pencarian (15 menit)
    let retryCount = 0;

    try {
        const serviceOrder = await ServiceOrder.findByPk(serviceOrderId);
        if (!serviceOrder) {
            logger.error(`Service order ${serviceOrderId} not found`);
            return;
        }

        // Set timeout 15 menit untuk pembatalan otomatis
        timeout = setTimeout(async () => {
            if (!jobCompleted) {
                jobCompleted = true;
                clearInterval(searchInterval);
                await serviceOrder.update({
                    status: 'cancelled',
                    notes: 'Tidak ada driver yang tersedia'
                });

                // Notify customer
                const customer = await User.findByPk(serviceOrder.customer_id);
                if (customer && customer.fcm_token) {
                    await sendNotification(
                        customer.fcm_token,
                        'Jasa Titip Dibatalkan',
                        'Maaf, tidak ada driver yang tersedia saat ini.',
                        { service_order_id: serviceOrder.id }
                    );
                }

                logger.info(`Service order ${serviceOrderId} dibatalkan karena timeout 15 menit`);
            }
        }, 15 * 60 * 1000);

        const maxDistance = 10; // 10km radius untuk service order
        const BATCH_SIZE = 10;

        // Fungsi untuk mencari driver dengan optimisasi
        const searchForDriver = async () => {
            if (jobCompleted) return;

            const now = Date.now();
            if (now - lastSearchTime < SEARCH_COOLDOWN) return;
            lastSearchTime = now;

            if (retryCount >= MAX_RETRIES) {
                jobCompleted = true;
                clearTimeout(timeout);
                clearInterval(searchInterval);
                await serviceOrder.update({
                    status: 'cancelled',
                    notes: 'Tidak ada driver yang tersedia setelah pencarian maksimal'
                });
                logger.info(`Service order ${serviceOrderId} dibatalkan karena mencapai batas maksimal pencarian`);
                return;
            }

            retryCount++;

            try {
                // Cek apakah sudah ada driver yang diterima
                const updatedServiceOrder = await ServiceOrder.findByPk(serviceOrderId);
                if (updatedServiceOrder.status !== 'pending') {
                    jobCompleted = true;
                    clearTimeout(timeout);
                    clearInterval(searchInterval);
                    logger.info(`Service order ${serviceOrderId} sudah memiliki status ${updatedServiceOrder.status}`);
                    return;
                }

                // Cari driver terdekat menggunakan query yang sama seperti order controller
                const drivers = await Driver.findAll({
                    where: {
                        latitude: { [Op.not]: null },
                        longitude: { [Op.not]: null },
                        status: 'active',
                        [Op.and]: [
                            sequelize.literal(`ST_Distance_Sphere(
                                point(longitude, latitude),
                                point(${serviceOrder.pickup_longitude}, ${serviceOrder.pickup_latitude})
                            ) <= ${maxDistance * 1000}`)
                        ]
                    },
                    include: [{
                        model: User,
                        as: 'user',
                        attributes: ['id', 'name', 'phone', 'fcm_token'],
                        required: true
                    }],
                    limit: BATCH_SIZE,
                    order: [
                        sequelize.literal(`ST_Distance_Sphere(
                            point(longitude, latitude),
                            point(${serviceOrder.pickup_longitude}, ${serviceOrder.pickup_latitude})
                        ) ASC`)
                    ]
                });

                if (drivers.length > 0) {
                    // Assign ke driver terdekat
                    const selectedDriver = drivers[0];

                    // Hitung estimated times seperti di order controller
                    const distance = euclideanDistance(
                        parseFloat(serviceOrder.pickup_latitude),
                        parseFloat(serviceOrder.pickup_longitude),
                        parseFloat(selectedDriver.latitude),
                        parseFloat(selectedDriver.longitude)
                    );

                    const averageSpeed = 30; // km/h
                    const timeToPickup = (distance / averageSpeed) * 60; // dalam menit
                    const preparationTime = 10; // menit
                    const totalPickupTime = Math.ceil(timeToPickup + preparationTime);

                    const now = new Date();
                    const estimatedPickupTime = new Date(now.getTime() + totalPickupTime * 60000);

                    // Untuk service order, estimasi delivery berdasarkan master location
                    let estimatedDeliveryTime;
                    if (serviceOrder.pickup_location_id) {
                        const pickupLocation = await MasterLocation.findByPk(serviceOrder.pickup_location_id);
                        if (pickupLocation) {
                            const deliveryDuration = pickupLocation.getEstimatedDuration();
                            estimatedDeliveryTime = new Date(estimatedPickupTime.getTime() + deliveryDuration * 60000);
                        }
                    }

                    if (!estimatedDeliveryTime) {
                        // Fallback: estimasi 30 menit delivery
                        estimatedDeliveryTime = new Date(estimatedPickupTime.getTime() + 30 * 60000);
                    }

                    // Update service order dengan driver dan estimated times
                    await serviceOrder.update({
                        driver_id: selectedDriver.id,
                        driver_phone: selectedDriver.user.phone,
                        status: 'driver_found',
                        estimated_pickup_time: estimatedPickupTime,
                        estimated_delivery_time: estimatedDeliveryTime
                    });

                    // Update driver status to busy
                    await selectedDriver.update({ status: 'busy' });

                    // Generate WhatsApp message
                    const whatsappMessage = generateWhatsAppMessage(serviceOrder, selectedDriver);

                    // Notify customer with driver info and WhatsApp link
                    const customer = await User.findByPk(serviceOrder.customer_id);
                    if (customer && customer.fcm_token) {
                        await sendNotification(
                            customer.fcm_token,
                            'Driver Ditemukan!',
                            `Driver ${selectedDriver.user.name} akan menangani pesanan Anda. Silakan hubungi via WhatsApp.`,
                            {
                                service_order_id: serviceOrder.id,
                                driver_name: selectedDriver.user.name,
                                driver_phone: selectedDriver.user.phone,
                                whatsapp_link: `https://wa.me/${selectedDriver.user.phone.replace(/\D/g, '')}?text=${encodeURIComponent(whatsappMessage)}`
                            }
                        );
                    }

                    // Notify driver
                    if (selectedDriver.user.fcm_token) {
                        await sendNotification(
                            selectedDriver.user.fcm_token,
                            'Jasa Titip Baru',
                            `Anda mendapat pesanan jasa titip dari ${customer ? customer.name : 'Customer'}. Silakan hubungi customer.`,
                            {
                                service_order_id: serviceOrder.id,
                                customer_name: customer ? customer.name : 'Customer',
                                customer_phone: serviceOrder.customer_phone,
                                whatsapp_link: `https://wa.me/${serviceOrder.customer_phone.replace(/\D/g, '')}?text=${encodeURIComponent(generateWhatsAppMessageForDriver(serviceOrder))}`
                            }
                        );
                    }

                    jobCompleted = true;
                    clearTimeout(timeout);
                    clearInterval(searchInterval);

                    logger.info('Driver assigned to service order:', {
                        serviceOrderId,
                        driverId: selectedDriver.id,
                        distance: distance
                    });
                    return;
                }

                logger.info(`Pencarian driver ke-${retryCount} untuk service order ${serviceOrderId}: ${drivers.length} driver ditemukan`);

            } catch (error) {
                logger.error('Error in driver search:', error);
            }
        };

        // Mulai pencarian
        await searchForDriver();

        // Set interval untuk pencarian berulang
        searchInterval = setInterval(searchForDriver, SEARCH_COOLDOWN);

    } catch (error) {
        logger.error('Error in findDriverInBackgroundForService:', error);
        if (timeout) clearTimeout(timeout);
        if (searchInterval) clearInterval(searchInterval);
    }
};

/**
 * Generate WhatsApp message for customer to driver
 */
const generateWhatsAppMessage = (serviceOrder, driver) => {
    return `Halo ${driver.user.name}, saya dari aplikasi DelPick.

Saya membutuhkan jasa titip dengan detail:
📍 Lokasi Pickup: ${serviceOrder.pickup_address}
📍 Lokasi Tujuan: ${serviceOrder.destination_address}
💰 Biaya Pengiriman: Rp ${serviceOrder.service_fee.toLocaleString()}
📝 Notes: ${serviceOrder.description || 'Tidak ada catatan khusus'}

Apakah Anda bisa menangani jasa titip ini? Terima kasih!`;
};

/**
 * Generate WhatsApp message for driver to customer
 */
const generateWhatsAppMessageForDriver = (serviceOrder) => {
    return `Halo, saya driver dari DelPick.

Saya telah menerima pesanan jasa titip Anda:
📍 Pickup: ${serviceOrder.pickup_address}
📍 Tujuan: ${serviceOrder.destination_address}
💰 Biaya Pengiriman: Rp ${serviceOrder.service_fee.toLocaleString()}

Saya akan segera menuju lokasi pickup. Terima kasih!`;
};

/**
 * Get available drivers for service order
 */
const getAvailableDriversForService = async (req, res) => {
    try {
        const { pickup_latitude, pickup_longitude, destination_address } = req.query;

        if (!pickup_latitude || !pickup_longitude || !destination_address) {
            return response(res, {
                statusCode: 400,
                message: 'Pickup latitude, longitude, dan destination address harus diisi'
            });
        }

        // Find available drivers
        const drivers = await Driver.findAll({
            where: {
                latitude: { [Op.not]: null },
                longitude: { [Op.not]: null },
                status: 'active',
                [Op.and]: [
                    sequelize.literal(`ST_Distance_Sphere(
                        point(longitude, latitude),
                        point(${pickup_longitude}, ${pickup_latitude})
                    ) <= ${15 * 1000}`)
                ]
            },
            include: [{
                model: User,
                as: 'user',
                attributes: ['id', 'name', 'phone', 'fcm_token'],
                required: true
            }],
            order: [
                sequelize.literal(`ST_Distance_Sphere(
                    point(longitude, latitude),
                    point(${pickup_longitude}, ${pickup_latitude})
                ) ASC`)
            ],
            limit: 5
        });

        if (drivers.length === 0) {
            return response(res, {
                statusCode: 404,
                message: 'Tidak ada driver yang tersedia saat ini'
            });
        }

        // Get service fee berdasarkan pickup location (destinasi tetap IT Del)
        const feeCalculation = await getServiceFeeFromPickupLocation(destination_address);
        const service_fee = feeCalculation.service_fee;

        // Format driver data for service page
        const availableDrivers = drivers.map(driver => {
            const distance = euclideanDistance(
                parseFloat(pickup_latitude),
                parseFloat(pickup_longitude),
                driver.latitude,
                driver.longitude
            ) * 111; // Convert to km

            return {
                id: driver.id,
                name: driver.user.name,
                phone: driver.user.phone,
                distance_km: Math.round(distance * 100) / 100,
                estimated_arrival: Math.ceil(distance / 30 * 60), // minutes
                whatsapp_link: `https://wa.me/${driver.user.phone.replace(/\D/g, '')}`,
                service_fee,
                destination_address
            };
        });

        return response(res, {
            statusCode: 200,
            message: 'Berhasil mendapatkan driver yang tersedia',
            data: {
                service_fee,
                destination_address,
                available_drivers: availableDrivers
            }
        });
    } catch (error) {
        logger.error('Error getting available drivers for service order:', error);
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat mencari driver',
            errors: error.message
        });
    }
};

/**
 * Get service orders by customer
 */
const getServiceOrdersByCustomer = async (req, res) => {
    try {
        const queryOptions = getQueryOptions(req.query);
        queryOptions.where = { customer_id: req.user.id };
        queryOptions.include = [
            {
                model: Driver,
                as: 'driver',
                include: [
                    {
                        model: User,
                        as: 'user',
                        attributes: ['id', 'name', 'phone']
                    }
                ],
                required: false
            },
            {
                model: DriverReview,
                as: 'review',
                required: false
            },
            {
                model: MasterLocation,
                as: 'pickup_location',
                required: false
            },
            {
                model: MasterLocation,
                as: 'destination_location',
                required: false
            }
        ];

        const { count, rows: serviceOrders } = await ServiceOrder.findAndCountAll(queryOptions);

        return response(res, {
            statusCode: 200,
            message: 'Berhasil mendapatkan data service orders',
            data: {
                totalItems: count,
                totalPages: Math.ceil(count / queryOptions.limit),
                currentPage: parseInt(req.query.page) || 1,
                serviceOrders
            }
        });
    } catch (error) {
        logger.error('Error getting service orders by customer:', error);
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat mengambil data service orders',
            errors: error.message
        });
    }
};

/**
 * Get service orders by driver
 */
const getServiceOrdersByDriver = async (req, res) => {
    try {
        // Get driver info from user
        const driver = await Driver.findOne({
            where: { user_id: req.user.id }
        });

        if (!driver) {
            return response(res, {
                statusCode: 404,
                message: 'Driver tidak ditemukan'
            });
        }

        const queryOptions = getQueryOptions(req.query);
        queryOptions.where = { driver_id: driver.id };
        queryOptions.include = [
            {
                model: User,
                as: 'customer',
                attributes: ['id', 'name', 'phone']
            },
            {
                model: DriverReview,
                as: 'review',
                required: false
            },
            {
                model: MasterLocation,
                as: 'pickup_location',
                required: false
            },
            {
                model: MasterLocation,
                as: 'destination_location',
                required: false
            }
        ];

        const { count, rows: serviceOrders } = await ServiceOrder.findAndCountAll(queryOptions);

        return response(res, {
            statusCode: 200,
            message: 'Berhasil mendapatkan data service orders',
            data: {
                totalItems: count,
                totalPages: Math.ceil(count / queryOptions.limit),
                currentPage: parseInt(req.query.page) || 1,
                serviceOrders
            }
        });
    } catch (error) {
        logger.error('Error getting service orders by driver:', error);
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat mengambil data service orders',
            errors: error.message
        });
    }
};

/**
 * Update service order status (by driver)
 */
const updateServiceOrderStatus = async (req, res) => {
    let transaction;
    try {
        transaction = await sequelize.transaction();
        const { id } = req.params;
        const { status, notes } = req.body;

        // Get driver info
        const driver = await Driver.findOne({
            where: { user_id: req.user.id }
        });

        if (!driver) {
            await transaction.rollback();
            return response(res, {
                statusCode: 404,
                message: 'Driver tidak ditemukan'
            });
        }

        const serviceOrder = await ServiceOrder.findOne({
            where: {
                id,
                driver_id: driver.id
            },
            include: [
                {
                    model: User,
                    as: 'customer',
                    attributes: ['id', 'name', 'fcm_token']
                }
            ],
            transaction
        });

        if (!serviceOrder) {
            await transaction.rollback();
            return response(res, {
                statusCode: 404,
                message: 'Service order tidak ditemukan'
            });
        }

        const updateData = { status };

        if (notes) {
            updateData.notes = notes;
        }

        // Set timestamps based on status
        if (status === 'in_progress') {
            updateData.actual_start_time = new Date();
        } else if (status === 'completed') {
            updateData.actual_completion_time = new Date();
            // Set driver status back to active
            await driver.update({ status: 'active' }, { transaction });
        } else if (status === 'cancelled') {
            // Set driver status back to active
            await driver.update({ status: 'active' }, { transaction });
        }

        await serviceOrder.update(updateData, { transaction });

        await transaction.commit();

        // Send notification to customer
        if (serviceOrder.customer && serviceOrder.customer.fcm_token) {
            let notificationTitle = '';
            let notificationBody = '';

            switch (status) {
                case 'in_progress':
                    notificationTitle = 'Service Dimulai';
                    notificationBody = 'Driver telah memulai mengerjakan pesanan Anda.';
                    break;
                case 'completed':
                    notificationTitle = 'Service Selesai';
                    notificationBody = 'Pesanan service Anda telah selesai. Silakan berikan review.';
                    break;
                case 'cancelled':
                    notificationTitle = 'Service Dibatalkan';
                    notificationBody = 'Pesanan service Anda telah dibatalkan oleh driver.';
                    break;
            }

            if (notificationTitle && notificationBody) {
                await sendNotification(
                    serviceOrder.customer.fcm_token,
                    notificationTitle,
                    notificationBody,
                    { service_order_id: serviceOrder.id }
                );
            }
        }

        logger.info('Service order status updated:', { service_order_id: serviceOrder.id, status });
        return response(res, {
            statusCode: 200,
            message: 'Status service order berhasil diperbarui',
            data: serviceOrder
        });
    } catch (error) {
        if (transaction) await transaction.rollback();
        logger.error('Error updating service order status:', error);
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat memperbarui status service order',
            errors: error.message
        });
    }
};

/**
 * Create review for service order
 */
const createServiceOrderReview = async (req, res) => {
    try {
        const { id: user_id } = req.user;
        const service_order_id = req.params.id;
        const { rating, comment } = req.body;

        // Cek apakah service order sudah selesai
        const serviceOrder = await ServiceOrder.findOne({
            where: { id: service_order_id, status: 'completed' },
        });

        if (!serviceOrder) {
            return response(res, {
                statusCode: 400,
                message: 'Hanya service order dengan status completed yang bisa direview'
            });
        }

        // Cek apakah review sudah ada untuk service order ini
        const existingReview = await DriverReview.findOne({
            where: { service_order_id: service_order_id, customer_id: user_id },
        });

        if (existingReview) {
            return response(res, {
                statusCode: 400,
                message: 'Anda sudah memberikan review untuk service order ini'
            });
        }

        // Buat review untuk driver
        if (rating && serviceOrder.driver_id) {
            await DriverReview.create({
                service_order_id: service_order_id,
                driver_id: serviceOrder.driver_id,
                customer_id: user_id,
                rating: rating,
                comment: comment || null,
            });

            // Update driver rating
            const driverData = await Driver.findByPk(serviceOrder.driver_id);
            if (driverData) {
                const totalRating = driverData.rating * driverData.reviews_count + rating;
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
            data: {
                service_order_id,
                driver_review: {
                    rating: rating,
                    comment: comment || null
                },
                driver_rating: driverData ? driverData.rating : null
            }
        });
    } catch (error) {
        logger.error('Error creating service order review:', error);
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat membuat review',
            errors: error.message,
        });
    }
};

/**
 * Get service order by ID
 */
const getServiceOrderById = async (req, res) => {
    try {
        const { id } = req.params;

        const serviceOrder = await ServiceOrder.findByPk(id, {
            include: [
                {
                    model: User,
                    as: 'customer',
                    attributes: ['id', 'name', 'phone']
                },
                {
                    model: Driver,
                    as: 'driver',
                    include: [
                        {
                            model: User,
                            as: 'user',
                            attributes: ['id', 'name', 'phone']
                        }
                    ],
                    required: false
                },
                {
                    model: DriverReview,
                    as: 'review',
                    required: false
                }
            ]
        });

        if (!serviceOrder) {
            return response(res, {
                statusCode: 404,
                message: 'Service order tidak ditemukan'
            });
        }

        // Check if user has access to this service order
        const isCustomer = serviceOrder.customer_id === req.user.id;
        const isDriver = serviceOrder.driver && serviceOrder.driver.user_id === req.user.id;
        const isAdmin = req.user.role === 'admin';

        if (!isCustomer && !isDriver && !isAdmin) {
            return response(res, {
                statusCode: 403,
                message: 'Anda tidak memiliki akses ke service order ini'
            });
        }

        return response(res, {
            statusCode: 200,
            message: 'Berhasil mendapatkan data service order',
            data: serviceOrder
        });
    } catch (error) {
        logger.error('Error getting service order by ID:', error);
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat mengambil data service order',
            errors: error.message
        });
    }
};

/**
 * Accept service order (by driver)
 */
const acceptServiceOrder = async (req, res) => {
    let transaction;
    try {
        transaction = await sequelize.transaction();
        const { customer_id, pickup_address, pickup_latitude, pickup_longitude, destination_address, destination_latitude, destination_longitude, description, customer_phone } = req.body;

        // Get driver info
        const driver = await Driver.findOne({
            where: { user_id: req.user.id },
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['id', 'name', 'phone']
                }
            ],
            transaction
        });

        if (!driver) {
            await transaction.rollback();
            return response(res, {
                statusCode: 404,
                message: 'Driver tidak ditemukan'
            });
        }

        if (driver.status !== 'active') {
            await transaction.rollback();
            return response(res, {
                statusCode: 400,
                message: 'Driver sedang tidak tersedia'
            });
        }

        // Get customer info
        const customer = await User.findByPk(customer_id, {
            attributes: ['id', 'name', 'fcm_token'],
            transaction
        });

        if (!customer) {
            await transaction.rollback();
            return response(res, {
                statusCode: 404,
                message: 'Customer tidak ditemukan'
            });
        }

        // Get service fee berdasarkan pickup location (destinasi tetap IT Del)
        const feeCalculation = await getServiceFeeFromPickupLocation(pickup_address);
        const service_fee = feeCalculation.service_fee;
        const estimated_duration = feeCalculation.estimated_duration;

        // Create service order
        const serviceOrderData = {
            customer_id,
            driver_id: driver.id,
            service_type: 'delivery', // Default to delivery for service order
            pickup_address,
            pickup_latitude,
            pickup_longitude,
            destination_address,
            destination_latitude,
            destination_longitude,
            description,
            service_fee,
            customer_phone,
            driver_phone: driver.user.phone,
            estimated_duration,
            status: 'driver_found'
        };

        // Add location references if found
        if (feeCalculation.pickup_location) {
            serviceOrderData.pickup_location_id = feeCalculation.pickup_location.id;
        }

        const serviceOrder = await ServiceOrder.create(serviceOrderData, { transaction });

        // Update driver status to busy
        await driver.update({
            status: 'busy'
        }, { transaction });

        await transaction.commit();

        // Notify customer
        if (customer.fcm_token) {
            await sendNotification(
                customer.fcm_token,
                'Jasa Titip Diterima!',
                `Driver ${driver.user.name} telah menerima pesanan jasa titip Anda. Silakan hubungi via WhatsApp.`,
                {
                    service_order_id: serviceOrder.id,
                    driver_name: driver.user.name,
                    driver_phone: driver.user.phone,
                    whatsapp_link: `https://wa.me/${driver.user.phone.replace(/\D/g, '')}?text=${encodeURIComponent(generateWhatsAppMessageForDriver(serviceOrder))}`
                }
            );
        }

        logger.info('Service order accepted by driver:', { service_order_id: serviceOrder.id, driver_id: driver.id });
        return response(res, {
            statusCode: 201,
            message: 'Jasa titip berhasil diterima',
            data: {
                ...serviceOrder.toJSON(),
                estimated_duration_text: `${estimated_duration} menit`,
                customer_whatsapp_link: `https://wa.me/${customer_phone.replace(/\D/g, '')}?text=${encodeURIComponent(generateWhatsAppMessageForDriver(serviceOrder))}`
            }
        });
    } catch (error) {
        if (transaction) await transaction.rollback();
        logger.error('Error accepting service order:', { error: error.message, stack: error.stack });
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat menerima jasa titip',
            errors: error.message
        });
    }
};

/**
 * Cancel service order (by customer)
 */
const cancelServiceOrder = async (req, res) => {
    let transaction;
    try {
        transaction = await sequelize.transaction();
        const { id } = req.params;
        const { reason } = req.body;

        const serviceOrder = await ServiceOrder.findOne({
            where: {
                id,
                customer_id: req.user.id,
                status: { [Op.in]: ['pending', 'driver_found'] }
            },
            include: [
                {
                    model: Driver,
                    as: 'driver',
                    include: [
                        {
                            model: User,
                            as: 'user',
                            attributes: ['id', 'name', 'fcm_token']
                        }
                    ],
                    required: false
                }
            ],
            transaction
        });

        if (!serviceOrder) {
            await transaction.rollback();
            return response(res, {
                statusCode: 404,
                message: 'Service order tidak ditemukan atau tidak dapat dibatalkan'
            });
        }

        // Update service order status
        await serviceOrder.update({
            status: 'cancelled',
            notes: reason || 'Dibatalkan oleh customer'
        }, { transaction });

        // If driver was assigned, set driver status back to active
        if (serviceOrder.driver) {
            await serviceOrder.driver.update({
                status: 'active'
            }, { transaction });

            // Notify driver
            if (serviceOrder.driver.user && serviceOrder.driver.user.fcm_token) {
                await sendNotification(
                    serviceOrder.driver.user.fcm_token,
                    'Service Order Dibatalkan',
                    'Service order yang Anda terima telah dibatalkan oleh customer.',
                    { service_order_id: serviceOrder.id }
                );
            }
        }

        await transaction.commit();

        logger.info('Service order cancelled by customer:', { service_order_id: serviceOrder.id });
        return response(res, {
            statusCode: 200,
            message: 'Service order berhasil dibatalkan',
            data: serviceOrder
        });
    } catch (error) {
        if (transaction) await transaction.rollback();
        logger.error('Error cancelling service order:', error);
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat membatalkan service order',
            errors: error.message
        });
    }
};

module.exports = {
    createServiceOrder,
    getAvailableDriversForService,
    acceptServiceOrder,
    getServiceOrdersByCustomer,
    getServiceOrdersByDriver,
    updateServiceOrderStatus,
    createServiceOrderReview,
    getServiceOrderById,
    cancelServiceOrder
}; 