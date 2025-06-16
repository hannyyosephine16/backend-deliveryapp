'use strict';

const { Store, User } = require('../models');
const { getQueryOptions } = require('../utils/queryHelper');
const response = require('../utils/response');
const bcrypt = require('bcryptjs');
const { saveBase64Image } = require('../utils/imageHelper');
const { logger } = require('../utils/logger');

/**
 * Get all stores
 */
const getAllStores = async (req, res) => {
    try {
        logger.info('Get all stores request');
        const queryOptions = getQueryOptions(req.query);

        // Include model User dan filter berdasarkan role 'store'
        queryOptions.include = [
            {
                model: User,
                as: 'owner',
                where: { role: 'store' },
            }
        ];

        const { count, rows: stores } = await Store.findAndCountAll(queryOptions);

        logger.info('Successfully retrieved stores', { count });
        return response(res, {
            statusCode: 200,
            message: 'Berhasil mendapatkan data store',
            data: stores,
            totalItems: count,
            totalPages: Math.ceil(count / queryOptions.limit),
            currentPage: parseInt(req.query.page) || 1,
        });
    } catch (error) {
        logger.error('Error getting stores:', { error: error.message, stack: error.stack });
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat mengambil data store',
            errors: error.message,
        });
    }
};

/**
 * Get store by ID
 */
const getStoreById = async (req, res) => {
    try {
        logger.info('Get store by ID request:', { storeId: req.params.id });
        const store = await Store.findByPk(req.params.id, {
            include: [
                { model: User, as: 'owner' },
            ],
        });

        if (!store) {
            logger.warn('Store not found:', { storeId: req.params.id });
            return response(res, {
                statusCode: 404,
                message: 'Store tidak ditemukan',
            });
        }

        logger.info('Successfully retrieved store:', { storeId: store.id });
        return response(res, {
            statusCode: 200,
            message: 'Berhasil mendapatkan data store',
            data: store,
        });
    } catch (error) {
        logger.error('Error getting store by ID:', { error: error.message, stack: error.stack });
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat mengambil data store',
            errors: error.message,
        });
    }
};

/**
 * Create new store
 */
const createStore = async (req, res) => {
    try {
        logger.info('Create store request:', { email: req.body.email });
        const {
            name,
            email,
            password,
            phone,
            address,
            description,
            image,
            latitude,
            longitude
        } = req.body;

        // Create user first
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            phone,
            role: 'store'
        });

        let image_url = null;
        if (image && image.startsWith('data:image')) {
            image_url = saveBase64Image(image, 'stores', 'store');
        }

        // Create store profile
        const store = await Store.create({
            user_id: user.id,
            name,
            address,
            description,
            image_url,
            phone,
            open_time: req.body.open_time || req.body.openTime,
            close_time: req.body.close_time || req.body.closeTime,
            latitude,
            longitude,
            status: 'active',
            rating: 0,
            total_products: 0,
            review_count: 0
        });

        logger.info('Store created successfully:', { storeId: store.id });
        return response(res, {
            statusCode: 201,
            message: 'Store berhasil ditambahkan',
            data: {
                user,
                store
            },
        });
    } catch (error) {
        logger.error('Error creating store:', { error: error.message, stack: error.stack });
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat menambahkan store',
            errors: error.message,
        });
    }
};

/**
 * Update store
 */
const updateStore = async (req, res) => {
    try {
        logger.info('Update store request:', { storeId: req.params.id });
        const {
            name,
            email,
            phone,
            address,
            description,
            image,
            open_time,
            close_time,
            latitude,
            longitude,
            status
        } = req.body;
        const store = await Store.findByPk(req.params.id, {
            include: [{ model: User, as: 'owner' }]
        });

        if (!store) {
            logger.warn('Store not found:', { storeId: req.params.id });
            return response(res, {
                statusCode: 404,
                message: 'Store tidak ditemukan',
            });
        }

        // Update user data
        await store.owner.update({
            name,
            email,
            phone
        });

        const updateData = {
            name,
            address,
            description,
            phone,
            open_time,
            close_time,
            latitude,
            longitude,
            status
        };

        if (image && image.startsWith('data:image')) {
            updateData.image_url = saveBase64Image(image, 'stores', 'store');
        }

        await store.update(updateData);

        logger.info('Store updated successfully:', { storeId: store.id });
        return response(res, {
            statusCode: 200,
            message: 'Store berhasil diperbarui',
            data: {
                user: store.owner,
                store
            },
        });
    } catch (error) {
        logger.error('Error updating store:', { error: error.message, stack: error.stack });
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat memperbarui store',
            errors: error.message,
        });
    }
};

/**
 * Delete store
 */
const deleteStore = async (req, res) => {
    try {
        logger.info('Delete store request:', { storeId: req.params.id });
        const store = await Store.findByPk(req.params.id, {
            include: [{ model: User, as: 'owner' }]
        });

        if (!store) {
            logger.warn('Store not found:', { storeId: req.params.id });
            return response(res, {
                statusCode: 404,
                message: 'Store tidak ditemukan',
            });
        }

        await store.destroy();
        await store.owner.destroy();

        logger.info('Store deleted successfully:', { storeId: req.params.id });
        return response(res, {
            statusCode: 200,
            message: 'Store berhasil dihapus',
        });
    } catch (error) {
        logger.error('Error deleting store:', { error: error.message, stack: error.stack });
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat menghapus store',
            errors: error.message,
        });
    }
};

module.exports = {
    getAllStores,
    getStoreById,
    createStore,
    updateStore,
    deleteStore,
};