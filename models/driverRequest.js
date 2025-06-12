'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class DriverRequest extends Model {
        static associate(models) {
            // Relasi ke Order
            DriverRequest.belongsTo(models.Order, {
                foreignKey: 'orderId',
                as: 'order',
            });

            // Relasi ke Driver
            DriverRequest.belongsTo(models.Driver, {
                foreignKey: 'driverId',
                as: 'driver',
            });
        }
    }

    DriverRequest.init(
        {
            orderId: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            driverId: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            status: {
                type: DataTypes.ENUM('pending', 'accepted', 'rejected', 'expired'),
                allowNull: false,
                defaultValue: 'pending', // Status: pending, accepted, rejected, expired
            },
        },
        {
            sequelize,
            modelName: 'DriverRequest',
        }
    );

    return DriverRequest;
};