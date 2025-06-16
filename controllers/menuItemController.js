'use strict';

const { MenuItem, Store } = require('../models');
const response = require('../utils/response');
const { saveBase64Image } = require('../utils/imageHelper');
const { logger } = require('../utils/logger');

/**
 * Get all menu items
 */
const getAllMenuItems = async (req, res) => {
    try {
        logger.info('Get all menu items request');
        const menuItems = await MenuItem.findAll({
            include: [{
                model: Store,
                as: 'store',
                attributes: ['name', 'image_url']
            }]
        });

        logger.info('Successfully retrieved menu items');
        return response(res, {
            statusCode: 200,
            message: 'Berhasil mendapatkan menu items',
            data: menuItems
        });
    } catch (error) {
        logger.error('Error getting menu items:', { error: error.message, stack: error.stack });
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat mengambil menu items',
            errors: error.message
        });
    }
};

/**
 * Get menu items by store
 */
const getMenuItemsByStore = async (req, res) => {
    try {
        logger.info('Get menu items by store request:', { store_id: req.params.store_id });
        const menuItems = await MenuItem.findAll({
            where: { store_id: req.params.store_id },
            include: [{
                model: Store,
                as: 'store',
                attributes: ['name', 'image_url']
            }]
        });

        logger.info('Successfully retrieved menu items for store:', { store_id: req.params.store_id });
        return response(res, {
            statusCode: 200,
            message: 'Berhasil mendapatkan menu items',
            data: menuItems
        });
    } catch (error) {
        logger.error('Error getting menu items by store:', { error: error.message, stack: error.stack });
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat mengambil menu items',
            errors: error.message
        });
    }
};

/**
 * Get menu item by ID
 */
const getMenuItemById = async (req, res) => {
    try {
        logger.info('Get menu item by ID request:', { menu_item_id: req.params.id });
        const menuItem = await MenuItem.findByPk(req.params.id, {
            include: [{
                model: Store,
                as: 'store',
                attributes: ['name', 'image_url']
            }]
        });

        if (!menuItem) {
            logger.warn('Menu item not found:', { menu_item_id: req.params.id });
            return response(res, {
                statusCode: 404,
                message: 'Menu item tidak ditemukan'
            });
        }

        logger.info('Successfully retrieved menu item:', { menu_item_id: menuItem.id });
        return response(res, {
            statusCode: 200,
            message: 'Berhasil mendapatkan menu item',
            data: menuItem
        });
    } catch (error) {
        logger.error('Error getting menu item by ID:', { error: error.message, stack: error.stack });
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat mengambil menu item',
            errors: error.message
        });
    }
};

/**
 * Create menu item
 */
const createMenuItem = async (req, res) => {
    try {
        logger.info('Create menu item request:', { store_id: req.body.store_id });
        const { name, price, description, store_id, category, is_available } = req.body;

        let image_url = null;
        if (req.body.image && req.body.image.startsWith('data:image')) {
            image_url = saveBase64Image(req.body.image, 'menu-items', 'item');
        }

        const menuItem = await MenuItem.create({
            name,
            price,
            description,
            image: image_url,
            store_id,
            category,
            is_available: is_available ?? true
        });

        logger.info('Menu item created successfully:', { menu_item_id: menuItem.id });
        return response(res, {
            statusCode: 201,
            message: 'Menu item berhasil ditambahkan',
            data: menuItem
        });
    } catch (error) {
        logger.error('Error creating menu item:', { error: error.message, stack: error.stack });
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat menambahkan menu item',
            errors: error.message
        });
    }
};

/**
 * Update menu item
 */
const updateMenuItem = async (req, res) => {
    try {
        logger.info('Update menu item request:', { menu_item_id: req.params.id });
        const { name, price, description, category, is_available } = req.body;
        const menuItem = await MenuItem.findByPk(req.params.id);

        if (!menuItem) {
            logger.warn('Menu item not found:', { menu_item_id: req.params.id });
            return response(res, {
                statusCode: 404,
                message: 'Menu item tidak ditemukan'
            });
        }

        const updateData = {
            name,
            price,
            description,
            category,
            is_available
        };

        if (req.body.image && req.body.image.startsWith('data:image')) {
            updateData.image = saveBase64Image(req.body.image, 'menu-items', 'item');
        }

        await menuItem.update(updateData);

        logger.info('Menu item updated successfully:', { menu_item_id: menuItem.id });
        return response(res, {
            statusCode: 200,
            message: 'Menu item berhasil diperbarui',
            data: menuItem
        });
    } catch (error) {
        logger.error('Error updating menu item:', { error: error.message, stack: error.stack });
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat memperbarui menu item',
            errors: error.message
        });
    }
};

/**
 * Delete menu item
 */
const deleteMenuItem = async (req, res) => {
    try {
        logger.info('Delete menu item request:', { menu_item_id: req.params.id });
        const menuItem = await MenuItem.findByPk(req.params.id);

        if (!menuItem) {
            logger.warn('Menu item not found:', { menu_item_id: req.params.id });
            return response(res, {
                statusCode: 404,
                message: 'Menu item tidak ditemukan'
            });
        }

        await menuItem.destroy();

        logger.info('Menu item deleted successfully:', { menu_item_id: req.params.id });
        return response(res, {
            statusCode: 200,
            message: 'Menu item berhasil dihapus'
        });
    } catch (error) {
        logger.error('Error deleting menu item:', { error: error.message, stack: error.stack });
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat menghapus menu item',
            errors: error.message
        });
    }
};

/**
 * Update menu item status
 */
const updateMenuItemStatus = async (req, res) => {
    try {
        logger.info('Update menu item status request:', { menu_item_id: req.params.id });
        const { is_available } = req.body;
        const menuItem = await MenuItem.findByPk(req.params.id);

        if (!menuItem) {
            logger.warn('Menu item not found:', { menu_item_id: req.params.id });
            return response(res, {
                statusCode: 404,
                message: 'Menu item tidak ditemukan'
            });
        }

        await menuItem.update({ is_available });

        logger.info('Menu item status updated successfully:', { menu_item_id: menuItem.id });
        return response(res, {
            statusCode: 200,
            message: 'Status menu item berhasil diperbarui',
            data: menuItem
        });
    } catch (error) {
        logger.error('Error updating menu item status:', { error: error.message, stack: error.stack });
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat memperbarui status menu item',
            errors: error.message
        });
    }
};

module.exports = {
    getAllMenuItems,
    getMenuItemsByStore,
    getMenuItemById,
    createMenuItem,
    updateMenuItem,
    deleteMenuItem,
    updateMenuItemStatus
};