'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class ServiceOrder extends Model {
        static associate(models) {
            // Relasi ke User (Customer)
            ServiceOrder.belongsTo(models.User, { foreignKey: 'customer_id', as: 'customer' });

            // Relasi ke Driver
            ServiceOrder.belongsTo(models.Driver, { foreignKey: 'driver_id', as: 'driver' });

            // Relasi ke DriverReview
            ServiceOrder.hasOne(models.DriverReview, { foreignKey: 'service_order_id', as: 'review' });

            // Relasi ke MasterLocation
            ServiceOrder.belongsTo(models.MasterLocation, { foreignKey: 'pickup_location_id', as: 'pickup_location' });
            ServiceOrder.belongsTo(models.MasterLocation, { foreignKey: 'destination_location_id', as: 'destination_location' });
        }
    }

    ServiceOrder.init({
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        customer_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        driver_id: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        service_type: {
            type: DataTypes.ENUM('delivery', 'transport', 'courier', 'other'),
            allowNull: false
        },
        pickup_address: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        pickup_latitude: {
            type: DataTypes.DECIMAL(10, 8),
            allowNull: false
        },
        pickup_longitude: {
            type: DataTypes.DECIMAL(11, 8),
            allowNull: false
        },
        destination_address: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        destination_latitude: {
            type: DataTypes.DECIMAL(10, 8),
            allowNull: false
        },
        destination_longitude: {
            type: DataTypes.DECIMAL(11, 8),
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        service_fee: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM('pending', 'driver_found', 'in_progress', 'completed', 'cancelled'),
            defaultValue: 'pending'
        },
        customer_phone: {
            type: DataTypes.STRING,
            allowNull: false
        },
        driver_phone: {
            type: DataTypes.STRING,
            allowNull: true
        },
        estimated_duration: {
            type: DataTypes.INTEGER, // in minutes
            allowNull: true
        },
        actual_start_time: {
            type: DataTypes.DATE,
            allowNull: true
        },
        actual_completion_time: {
            type: DataTypes.DATE,
            allowNull: true
        },
        pickup_location_id: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        destination_location_id: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    }, {
        sequelize,
        modelName: 'ServiceOrder',
        tableName: 'service_orders',
        timestamps: false
    });

    return ServiceOrder;
}; 