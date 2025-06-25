'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class DriverReview extends Model {
        static associate(models) {
            // Relasi ke Driver
            DriverReview.belongsTo(models.Driver, {
                foreignKey: 'driver_id',
                as: 'driver',
            });

            // Relasi ke User (customer yang memberikan review)
            DriverReview.belongsTo(models.User, {
                foreignKey: 'customer_id',
                as: 'customer',
            });

            // Relasi ke Order (nullable untuk service orders)
            DriverReview.belongsTo(models.Order, {
                foreignKey: 'order_id',
                as: 'order',
                required: false
            });

            // Relasi ke ServiceOrder (nullable untuk regular orders)
            DriverReview.belongsTo(models.ServiceOrder, {
                foreignKey: 'service_order_id',
                as: 'serviceOrder',
                required: false
            });
        }
    }
    DriverReview.init(
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            order_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            service_order_id: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            driver_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            customer_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            rating: {
                type: DataTypes.INTEGER,
                allowNull: false,
                validate: {
                    min: 1,
                    max: 5,
                },
            },
            comment: {
                type: DataTypes.TEXT,
                allowNull: true,
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
        },
        {
            sequelize,
            modelName: 'DriverReview',
            tableName: 'driver_reviews',
            timestamps: false,
            validate: {
                // Ensure either order_id or service_order_id is present
                eitherOrderOrServiceOrder() {
                    if (!this.order_id && !this.service_order_id) {
                        throw new Error('Either order_id or service_order_id must be provided');
                    }
                    if (this.order_id && this.service_order_id) {
                        throw new Error('Cannot have both order_id and service_order_id');
                    }
                }
            }
        }
    );
    return DriverReview;
};