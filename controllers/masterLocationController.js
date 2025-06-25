'use strict';

const { MasterLocation, sequelize } = require('../models');
const { getQueryOptions } = require('../utils/queryHelper');
const response = require('../utils/response');
const { logger } = require('../utils/logger');
const euclideanDistance = require('../utils/euclideanDistance');
const { Op } = require('sequelize');

/**
 * Get all active locations
 */
const getAllLocations = async (req, res) => {
    try {
        const queryOptions = getQueryOptions(req.query);
        queryOptions.where = { is_active: true };
        queryOptions.order = [['name', 'ASC']];

        const { count, rows: locations } = await MasterLocation.findAndCountAll(queryOptions);

        return response(res, {
            statusCode: 200,
            message: 'Berhasil mendapatkan data lokasi',
            data: {
                totalItems: count,
                totalPages: Math.ceil(count / queryOptions.limit),
                currentPage: parseInt(req.query.page) || 1,
                locations
            }
        });
    } catch (error) {
        logger.error('Error getting locations:', error);
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat mengambil data lokasi',
            errors: error.message
        });
    }
};

/**
 * Get popular locations
 */
const getPopularLocations = async (req, res) => {
    try {
        const locations = await MasterLocation.findAll({
            where: { is_active: true },
            order: [['name', 'ASC']]
        });

        return response(res, {
            statusCode: 200,
            message: 'Berhasil mendapatkan lokasi populer',
            data: { locations }
        });
    } catch (error) {
        logger.error('Error getting popular locations:', error);
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat mengambil lokasi populer',
            errors: error.message
        });
    }
};

/**
 * Search locations by name or address
 */
const searchLocations = async (req, res) => {
    try {
        const { q: query } = req.query;

        if (!query || query.length < 2) {
            return response(res, {
                statusCode: 400,
                message: 'Query pencarian minimal 2 karakter'
            });
        }

        const locations = await MasterLocation.findAll({
            where: {
                is_active: true,
                name: { [Op.iLike]: `%${query}%` }
            },
            order: [['name', 'ASC']]
        });

        return response(res, {
            statusCode: 200,
            message: 'Berhasil mencari lokasi',
            data: { locations }
        });
    } catch (error) {
        logger.error('Error searching locations:', error);
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat mencari lokasi',
            errors: error.message
        });
    }
};

/**
 * Get service fee for pickup location (destinasi tetap ke IT Del)
 */
const getServiceFee = async (req, res) => {
    try {
        const { pickup_location_id } = req.query;

        if (!pickup_location_id) {
            return response(res, {
                statusCode: 400,
                message: 'Pickup location ID harus diisi'
            });
        }

        const pickupLocation = await MasterLocation.findByPk(pickup_location_id);

        if (!pickupLocation) {
            return response(res, {
                statusCode: 404,
                message: 'Lokasi tidak ditemukan'
            });
        }

        if (!pickupLocation.is_active) {
            return response(res, {
                statusCode: 400,
                message: 'Lokasi tidak aktif'
            });
        }

        // Harga tetap per region, destinasi tetap ke IT Del
        const service_fee = pickupLocation.getServiceFee();
        const estimated_duration = pickupLocation.getEstimatedDuration();

        return response(res, {
            statusCode: 200,
            message: 'Berhasil mendapatkan biaya layanan',
            data: {
                pickup_location: {
                    id: pickupLocation.id,
                    name: pickupLocation.name
                },
                destination: 'IT Del',
                service_fee,
                estimated_duration,
                estimated_duration_text: `${estimated_duration} menit`
            }
        });
    } catch (error) {
        logger.error('Error getting service fee:', error);
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat mengambil biaya layanan',
            errors: error.message
        });
    }
};

/**
 * Get location by ID
 */
const getLocationById = async (req, res) => {
    try {
        const { id } = req.params;

        const location = await MasterLocation.findByPk(id);

        if (!location) {
            return response(res, {
                statusCode: 404,
                message: 'Lokasi tidak ditemukan'
            });
        }

        return response(res, {
            statusCode: 200,
            message: 'Berhasil mendapatkan detail lokasi',
            data: { location }
        });
    } catch (error) {
        logger.error('Error getting location by ID:', error);
        return response(res, {
            statusCode: 500,
            message: 'Terjadi kesalahan saat mengambil detail lokasi',
            errors: error.message
        });
    }
};

module.exports = {
    getAllLocations,
    getPopularLocations,
    searchLocations,
    getServiceFee,
    getLocationById
}; 