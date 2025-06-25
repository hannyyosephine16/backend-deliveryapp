'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class MasterLocation extends Model {
        static associate(models) {
            // Relasi ke ServiceOrder sebagai pickup location
            MasterLocation.hasMany(models.ServiceOrder, {
                foreignKey: 'pickup_location_id',
                as: 'pickup_orders'
            });

            // Relasi ke ServiceOrder sebagai destination location
            MasterLocation.hasMany(models.ServiceOrder, {
                foreignKey: 'destination_location_id',
                as: 'destination_orders'
            });
        }

        /**
 * Get fixed service fee for this location (destinasi tetap ke IT Del)
 */
        getServiceFee() {
            return parseFloat(this.service_fee);
        }

        /**
         * Get estimated duration for this location
         */
        getEstimatedDuration() {
            return this.estimated_duration_minutes;
        }
    }

    MasterLocation.init({
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        latitude: {
            type: DataTypes.DECIMAL(10, 8),
            allowNull: false
        },
        longitude: {
            type: DataTypes.DECIMAL(11, 8),
            allowNull: false
        },
        service_fee: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        estimated_duration_minutes: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
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
        modelName: 'MasterLocation',
        tableName: 'master_locations',
        timestamps: false
    });

    return MasterLocation;
}; 