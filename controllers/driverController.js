const { Driver, User, Order } = require('../models');
const { getQueryOptions } = require('../utils/queryHelper');
const response = require('../utils/response');
const bcrypt = require('bcryptjs');
const { saveBase64Image } = require('../utils/imageHelper');
const { logger } = require('../utils/logger');

/**
 * Mendapatkan semua driver
 */
const getAllDrivers = async (req, res) => {
    try {
        logger.info('Get all drivers request');
        const queryOptions = getQueryOptions(req.query);

        // Include model User dan filter berdasarkan role 'driver'
        queryOptions.include = [
            {
                model: User,
                as: 'user',
                where: { role: 'driver' },
            },
        ];

        const { count, rows: drivers } = await Driver.findAndCountAll(queryOptions);

        logger.info('Successfully retrieved drivers', { count });
        return response(res, {
            statusCode: 200,
            message: 'Berhasil mendapatkan data driver',
            data: drivers,
            totalItems: count,
            totalPages: Math.ceil(count / queryOptions.limit),
            currentPage: parseInt(req.query.page) || 1,
        });
    } catch (error) {
        logger.error('Error getting drivers:', { error: error.message, stack: error.stack });
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat mengambil data driver',
            errors: error.message,
        });
    }
};

/**
 * Mendapatkan driver berdasarkan ID
 */
const getDriverById = async (req, res) => {
    try {
        logger.info('Get driver by ID request:', { driverId: req.params.id });
        const driver = await Driver.findByPk(req.params.id, {
            include: [
                { model: User, as: 'user' },
                { model: Order, as: 'orders' },
            ],
        });

        if (!driver) {
            logger.warn('Driver not found:', { driverId: req.params.id });
            return response(res, {
                statusCode: 404,
                message: 'Driver tidak ditemukan',
            });
        }

        logger.info('Successfully retrieved driver:', { driverId: driver.id });
        return response(res, {
            statusCode: 200,
            message: 'Berhasil mendapatkan data driver',
            data: driver,
        });
    } catch (error) {
        logger.error('Error getting driver by ID:', { error: error.message, stack: error.stack });
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat mengambil data driver',
            errors: error.message,
        });
    }
};

/**
 * Menambahkan driver baru
 */
const createDriver = async (req, res) => {
    try {
        logger.info('Create driver request:', { email: req.body.email });
        const { name, email, password, phone, vehicle_number, image } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);

        let imagePath = null;
        if (image && image.startsWith('data:image')) {
            imagePath = saveBase64Image(image, 'users', 'avatar');
        }

        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            phone,
            role: 'driver',
            avatar: imagePath
        });

        const driver = await Driver.create({
            userId: user.id,
            vehicle_number,
            rating: 0,
            reviews_count: 0,
            latitude: null,
            longitude: null,
            status: 'inactive',
        });

        logger.info('Driver created successfully:', { driverId: driver.id, userId: user.id });
        return response(res, {
            statusCode: 201,
            message: 'Driver berhasil ditambahkan',
            data: { user, driver },
        });
    } catch (error) {
        logger.error('Error creating driver:', { error: error.message, stack: error.stack });
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat menambahkan driver',
            errors: error.message,
        });
    }
};

/**
 * Mengupdate driver berdasarkan ID
 */
const updateDriver = async (req, res) => {
    try {
        logger.info('Update driver request:', { driverId: req.params.id });
        const { id } = req.params;
        const { name, email, password, phone, vehicle_number, latitude, longitude, status, image } = req.body;

        const driver = await Driver.findByPk(id, {
            include: [{ model: User, as: 'user' }],
        });

        if (!driver) {
            logger.warn('Driver not found for update:', { driverId: id });
            return response(res, {
                statusCode: 404,
                message: 'Driver tidak ditemukan',
            });
        }

        // Update data User
        if (name || email || phone || password) {
            const userData = {};
            if (name) userData.name = name;
            if (email) userData.email = email;
            if (phone) userData.phone = phone;
            if (password) userData.password = await bcrypt.hash(password, 10);

            await driver.user.update(userData);
        }

        let imagePath = null;
        if (image && image.startsWith('data:image')) {
            imagePath = saveBase64Image(image, 'users', 'avatar');
            driver.user.avatar = imagePath;
            await driver.user.save();
        }

        // Update data Driver
        const driverData = {};
        if (vehicle_number) driverData.vehicle_number = vehicle_number;
        if (latitude) driverData.latitude = latitude;
        if (longitude) driverData.longitude = longitude;
        if (status) driverData.status = status;

        await driver.update(driverData);

        logger.info('Driver updated successfully:', { driverId: driver.id });
        return response(res, {
            statusCode: 200,
            message: 'Driver berhasil diupdate',
            data: driver,
        });
    } catch (error) {
        logger.error('Error updating driver:', { error: error.message, stack: error.stack });
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat mengupdate driver',
            errors: error.message,
        });
    }
};

/**
 * Menghapus driver berdasarkan ID
 */
const deleteDriver = async (req, res) => {
    try {
        logger.info('Delete driver request:', { driverId: req.params.id });
        const { id } = req.params;

        const driver = await Driver.findByPk(id, {
            include: [{ model: User, as: 'user' }],
        });

        if (!driver) {
            logger.warn('Driver not found for deletion:', { driverId: id });
            return response(res, {
                statusCode: 404,
                message: 'Driver tidak ditemukan',
            });
        }

        await driver.user.destroy();
        await driver.destroy();

        logger.info('Driver deleted successfully:', { driverId: id });
        return response(res, {
            statusCode: 200,
            message: 'Driver berhasil dihapus',
        });
    } catch (error) {
        logger.error('Error deleting driver:', { error: error.message, stack: error.stack });
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat menghapus driver',
            errors: error.message,
        });
    }
};

/**
 * Update lokasi driver (untuk dipanggil setiap 5-15 detik)
 */
const updateDriverLocation = async (req, res) => {
    try {
        logger.info('Update driver location request:', { userId: req.user.id });
        const { id: userId } = req.user;
        const { latitude, longitude } = req.body;

        const driver = await Driver.findOne({
            where: { userId },
            include: [
                {
                    model: User,
                    as: 'user',
                },
            ],
        });

        if (!driver) {
            logger.warn('Driver not found for location update:', { userId });
            return response(res, { statusCode: 404, message: 'Driver tidak ditemukan' });
        }

        await driver.update({ latitude, longitude });

        logger.info('Driver location updated successfully:', { driverId: driver.id });
        return response(res, {
            statusCode: 200,
            message: 'Lokasi driver berhasil diperbarui',
            data: {
                latitude,
                longitude,
                updatedAt: new Date()
            },
        });
    } catch (error) {
        logger.error('Error updating driver location:', { error: error.message, stack: error.stack });
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat memperbarui lokasi driver',
            errors: error.message,
        });
    }
};

/**
 * Mendapatkan lokasi driver terbaru (untuk dipanggil oleh client setiap 5-15 detik)
 */
const getDriverLocation = async (req, res) => {
    try {
        const { driverId } = req.params;

        const driver = await Driver.findByPk(driverId, {
            attributes: ['id', 'latitude', 'longitude', 'updatedAt'],
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['name']
                }
            ]
        });

        if (!driver) {
            return response(res, { statusCode: 404, message: 'Driver tidak ditemukan' });
        }

        if (!driver.latitude || !driver.longitude) {
            return response(res, {
                statusCode: 404,
                message: 'Lokasi driver belum tersedia'
            });
        }

        return response(res, {
            statusCode: 200,
            message: 'Lokasi driver berhasil didapatkan',
            data: {
                driverId: driver.id,
                name: driver.user.name,
                latitude: driver.latitude,
                longitude: driver.longitude,
                lastUpdated: driver.updatedAt
            }
        });
    } catch (error) {
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat mengambil lokasi driver',
            errors: error.message,
        });
    }
};

/**
 * Mengubah status driver (active/inactive)
 */
const updateDriverStatus = async (req, res) => {
    try {
        const { id: userId } = req.user;

        const { status } = req.body;

        if (!['active', 'inactive'].includes(status)) {
            return response(res, {
                statusCode: 400,
                message: 'Status tidak valid. Harus "active" atau "inactive".',
            });
        }

        const driver = await Driver.findOne({
            where: { userId },
        });
        if (!driver) {
            return response(res, { statusCode: 404, message: 'Driver tidak ditemukan' });
        }

        await driver.update({ status });

        return response(res, {
            statusCode: 200,
            message: 'Status driver berhasil diperbarui',
            data: driver,
        });
    } catch (error) {
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat memperbarui status driver',
            errors: error.message,
        });
    }
};

/**
 * Mengupdate driver oleh driver yang sedang login
 */
const updateProfileDriver = async (req, res) => {
    try {
        const { id: userId } = req.user;
        const { name, email, password, phone, vehicle_number, latitude, longitude } = req.body;

        const driver = await Driver.findOne({
            where: { userId },
            include: [{ model: User, as: 'user' }],
        });

        if (!driver) {
            return response(res, {
                statusCode: 404,
                message: 'Driver tidak ditemukan atau Anda tidak memiliki akses',
            });
        }

        // Update data User
        if (name || email || phone || password) {
            const userData = {};
            if (name) userData.name = name;
            if (email) userData.email = email;
            if (phone) userData.phone = phone;
            if (password) userData.password = await bcrypt.hash(password, 10);

            await driver.user.update(userData);
        }

        // Update data Driver
        const driverData = {};
        if (vehicle_number) driverData.vehicle_number = vehicle_number;
        if (latitude) driverData.latitude = latitude;
        if (longitude) driverData.longitude = longitude;

        await driver.update(driverData);

        return response(res, {
            statusCode: 200,
            message: 'Data driver berhasil diupdate',
            data: driver,
        });
    } catch (error) {
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat mengupdate data driver',
            errors: error.message,
        });
    }
};

/**
 * Mendapatkan semua order berdasarkan driver yang login
 */
const getDriverOrders = async (req, res) => {
    try {
        const { id: userId } = req.user;
        const queryOptions = getQueryOptions(req.query);

        // Find the driver associated with the logged-in user
        const driver = await Driver.findOne({
            where: { userId },
        });

        if (!driver) {
            return response(res, {
                statusCode: 404,
                message: 'Driver tidak ditemukan',
            });
        }

        // Query orders for the driver
        queryOptions.where = { driverId: driver.id };
        queryOptions.include = [
            {
                model: User,
                as: 'customer', // Assuming Order has a belongsTo association with User as 'customer'
                attributes: ['id', 'name', 'email'],
            },
        ];

        const { count, rows: orders } = await Order.findAndCountAll(queryOptions);

        return response(res, {
            statusCode: 200,
            message: 'Berhasil mendapatkan data order driver',
            data: orders,
            totalItems: count,
            totalPages: Math.ceil(count / queryOptions.limit),
            currentPage: parseInt(req.query.page) || 1,
        });
    } catch (error) {
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat mengambil data order driver',
            errors: error.message,
        });
    }
};

module.exports = {
    getAllDrivers,
    getDriverById,
    createDriver,
    updateDriver,
    deleteDriver,
    updateDriverLocation,
    getDriverLocation,
    updateDriverStatus,
    updateProfileDriver,
    getDriverOrders, // Add new function to exports
};