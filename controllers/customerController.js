const { User } = require('../models');
const { getQueryOptions } = require('../utils/queryHelper');
const response = require('../utils/response');
const bcrypt = require('bcryptjs');
const { saveBase64Image } = require('../utils/imageHelper');
const { logger } = require('../utils/logger');

/**
 * Mendapatkan semua customer
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const getAllCustomers = async (req, res) => {
    try {
        logger.info('Get all customers request');
        const queryOptions = getQueryOptions(req.query);

        // Filter hanya untuk role 'customer'
        queryOptions.where = { role: 'customer' };

        const { count, rows: customers } = await User.findAndCountAll(queryOptions);

        logger.info('Successfully retrieved customers', { count });
        return response(res, {
            statusCode: 200,
            message: 'Berhasil mendapatkan data customer',
            data: {
                totalItems: count,
                totalPages: Math.ceil(count / queryOptions.limit),
                currentPage: parseInt(req.query.page) || 1,
                customers,
            },
        });
    } catch (error) {
        logger.error('Error getting customers:', { error: error.message, stack: error.stack });
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat mengambil data customer',
            errors: error.message,
        });
    }
};

/**
 * Mendapatkan customer berdasarkan ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const getCustomerById = async (req, res) => {
    try {
        logger.info('Get customer by ID request:', { customerId: req.params.id });
        const customer = await User.findOne({
            where: {
                id: req.params.id,
                role: 'customer', // Pastikan role adalah 'customer'
            },
        });

        if (!customer) {
            logger.warn('Customer not found:', { customerId: req.params.id });
            return response(res, {
                statusCode: 404,
                message: 'Customer tidak ditemukan',
            });
        }

        logger.info('Successfully retrieved customer:', { customerId: customer.id });
        return response(res, {
            statusCode: 200,
            message: 'Berhasil mendapatkan data customer',
            data: customer,
        });
    } catch (error) {
        logger.error('Error getting customer by ID:', { error: error.message, stack: error.stack });
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat mengambil data customer',
            errors: error.message,
        });
    }
};

/**
 * Menambahkan customer baru
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const createCustomer = async (req, res) => {
    try {
        logger.info('Create customer request:', { email: req.body.email });
        const { name, email, password, phone, image } = req.body;

        const hashedPassword = await bcrypt.hash(password, 10);

        let imagePath = null;
        if (image && image.startsWith('data:image')) {
            imagePath = saveBase64Image(image, 'users', 'avatar');
        }

        const customer = await User.create({
            name,
            email,
            password: hashedPassword,
            phone,
            role: 'customer',
            avatar: imagePath
        });

        logger.info('Customer created successfully:', { customerId: customer.id });
        return response(res, {
            statusCode: 201,
            message: 'Customer berhasil ditambahkan',
            data: customer,
        });
    } catch (error) {
        logger.error('Error creating customer:', { error: error.message, stack: error.stack });
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat menambahkan customer',
            errors: error.message,
        });
    }
};

/**
 * Mengupdate customer berdasarkan ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const updateCustomer = async (req, res) => {
    try {
        logger.info('Update customer request:', { customerId: req.params.id });
        const { id } = req.params;
        const { name, email, password, phone, image } = req.body;

        const customer = await User.findOne({
            where: {
                id,
                role: 'customer', // Pastikan role adalah 'customer'
            },
        });

        if (!customer) {
            logger.warn('Customer not found for update:', { customerId: id });
            return response(res, {
                statusCode: 404,
                message: 'Customer tidak ditemukan',
            });
        }

        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            customer.password = hashedPassword;
        }

        let imagePath = null;
        if (image && image.startsWith('data:image')) {
            imagePath = saveBase64Image(image, 'users', 'avatar');
        }

        await customer.update({
            name,
            email,
            phone,
            avatar: imagePath
        });

        logger.info('Customer updated successfully:', { customerId: customer.id });
        return response(res, {
            statusCode: 200,
            message: 'Customer berhasil diupdate',
            data: customer,
        });
    } catch (error) {
        logger.error('Error updating customer:', { error: error.message, stack: error.stack });
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat mengupdate customer',
            errors: error.message,
        });
    }
};

/**
 * Menghapus customer berdasarkan ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const deleteCustomer = async (req, res) => {
    try {
        logger.info('Delete customer request:', { customerId: req.params.id });
        const { id } = req.params;

        const customer = await User.findOne({
            where: {
                id,
                role: 'customer', // Pastikan role adalah 'customer'
            },
        });

        if (!customer) {
            logger.warn('Customer not found for deletion:', { customerId: id });
            return response(res, {
                statusCode: 404,
                message: 'Customer tidak ditemukan',
            });
        }

        await customer.destroy();

        logger.info('Customer deleted successfully:', { customerId: id });
        return response(res, {
            statusCode: 200,
            message: 'Customer berhasil dihapus',
        });
    } catch (error) {
        logger.error('Error deleting customer:', { error: error.message, stack: error.stack });
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat menghapus customer',
            errors: error.message,
        });
    }
};

module.exports = {
    getAllCustomers,
    getCustomerById,
    createCustomer,
    updateCustomer,
    deleteCustomer,
};