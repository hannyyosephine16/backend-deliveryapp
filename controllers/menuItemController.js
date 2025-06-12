const { MenuItem, Store } = require('../models');
const { getQueryOptions } = require('../utils/queryHelper');
const response = require('../utils/response');
const { saveBase64Image } = require('../utils/imageHelper');
const { logger } = require('../utils/logger');

/** 
 * Helper untuk ambil store berdasarkan user
 * */
const getStoreByUserId = async (userId) => {
    return await Store.findOne({ where: { userId } });
};

/**
 * Mendapatkan semua menu item
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const getAllMenuItems = async (req, res) => {
    try {
        logger.info('Get all menu items request');
        const queryOptions = getQueryOptions(req.query, [{ model: Store, as: 'store' }]);

        const { count, rows: menuItems } = await MenuItem.findAndCountAll(queryOptions);

        logger.info('Successfully retrieved menu items', { count });
        return response(res, {
            statusCode: 200,
            message: 'Berhasil mendapatkan data menu',
            data: {
                totalItems: count,
                totalPages: Math.ceil(count / queryOptions.limit),
                currentPage: parseInt(req.query.page) || 1,
                menuItems,
            },
        });
    } catch (error) {
        logger.error('Error getting menu items:', { error: error.message, stack: error.stack });
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat mengambil data menu',
            errors: error.message,
        });
    }
};

/**
 * Mendapatkan menu item berdasarkan storeId
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const getMenuItemsByStoreId = async (req, res) => {
    try {
        const { id } = req.params;
        const queryOptions = getQueryOptions(req.query);

        // Filter berdasarkan storeId
        queryOptions.where = { storeId: id };

        const { count, rows: menuItems } = await MenuItem.findAndCountAll(queryOptions);

        return response(res, {
            statusCode: 200,
            message: 'Berhasil mendapatkan data menu item',
            data: {
                totalItems: count,
                totalPages: Math.ceil(count / queryOptions.limit),
                currentPage: parseInt(req.query.page) || 1,
                menuItems,
            },
        });
    } catch (error) {
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat mengambil data menu item',
            errors: error.message,
        });
    }
};

/**
 * Mendapatkan menu item berdasarkan ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const getMenuItemById = async (req, res) => {
    try {
        logger.info('Get menu item by ID request:', { menuItemId: req.params.id });
        const menuItem = await MenuItem.findByPk(req.params.id, {
            include: [{ model: Store, as: 'store' }],
        });

        if (!menuItem) {
            logger.warn('Menu item not found:', { menuItemId: req.params.id });
            return response(res, {
                statusCode: 404,
                message: 'Menu tidak ditemukan',
            });
        }

        logger.info('Successfully retrieved menu item:', { menuItemId: menuItem.id });
        return response(res, {
            statusCode: 200,
            message: 'Berhasil mendapatkan data menu',
            data: menuItem,
        });
    } catch (error) {
        logger.error('Error getting menu item by ID:', { error: error.message, stack: error.stack });
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat mengambil data menu',
            errors: error.message,
        });
    }
};

/**
 * Menambahkan menu item baru
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const createMenuItem = async (req, res) => {
    try {
        logger.info('Create menu item request:', { storeId: req.body.storeId, name: req.body.name });
        const { name, description, price, image, storeId } = req.body;

        // Simpan gambar jika imageUrl berupa base64
        let imagePath = null;
        if (image && image.startsWith('data:image')) {
            imagePath = saveBase64Image(image, 'menu-items', 'menu');
        }

        const menuItem = await MenuItem.create({
            name,
            description,
            price,
            imageUrl: imagePath,
            storeId,
        });

        logger.info('Menu item created successfully:', { menuItemId: menuItem.id });
        return response(res, {
            statusCode: 201,
            message: 'Menu berhasil ditambahkan',
            data: menuItem,
        });
    } catch (error) {
        logger.error('Error creating menu item:', { error: error.message, stack: error.stack });
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat menambahkan menu',
            errors: error.message,
        });
    }
};

/**
 * Mengupdate menu item berdasarkan ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const updateMenuItem = async (req, res) => {
    try {
        logger.info('Update menu item request:', { menuItemId: req.params.id });
        const { id } = req.params;
        const { name, description, price, image } = req.body;

        const menuItem = await MenuItem.findByPk(id);
        if (!menuItem) {
            logger.warn('Menu item not found for update:', { menuItemId: id });
            return response(res, { statusCode: 404, message: 'Menu tidak ditemukan' });
        }

        // Simpan gambar jika imageUrl berupa base64
        let imagePath = menuItem.imageUrl;
        if (image && image.startsWith('data:image')) {
            imagePath = saveBase64Image(image, 'menu-items', 'menu');
        }

        await menuItem.update({
            name,
            description,
            price,
            imageUrl: imagePath,
        });

        logger.info('Menu item updated successfully:', { menuItemId: menuItem.id });
        return response(res, {
            statusCode: 200,
            message: 'Menu berhasil diupdate',
            data: menuItem,
        });
    } catch (error) {
        logger.error('Error updating menu item:', { error: error.message, stack: error.stack });
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat mengupdate menu',
            errors: error.message,
        });
    }
};

/**
 * Menghapus menu item berdasarkan ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const deleteMenuItem = async (req, res) => {
    try {
        logger.info('Delete menu item request:', { menuItemId: req.params.id });
        const { id } = req.params;

        const menuItem = await MenuItem.findByPk(id);
        if (!menuItem) {
            logger.warn('Menu item not found for deletion:', { menuItemId: id });
            return response(res, { statusCode: 404, message: 'Menu tidak ditemukan' });
        }

        await menuItem.destroy();

        logger.info('Menu item deleted successfully:', { menuItemId: id });
        return response(res, {
            statusCode: 200,
            message: 'Menu berhasil dihapus',
        });
    } catch (error) {
        logger.error('Error deleting menu item:', { error: error.message, stack: error.stack });
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat menghapus menu',
            errors: error.message,
        });
    }
};

module.exports = {
    getAllMenuItems,
    getMenuItemById,
    getMenuItemsByStoreId,
    createMenuItem,
    updateMenuItem,
    deleteMenuItem,
};