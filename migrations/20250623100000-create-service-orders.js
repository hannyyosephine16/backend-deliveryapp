'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('service_orders', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            customer_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'CASCADE'
            },
            driver_id: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'drivers',
                    key: 'id'
                },
                onUpdate: 'CASCADE',
                onDelete: 'SET NULL'
            },
            pickup_address: {
                type: Sequelize.TEXT,
                allowNull: false
            },
            pickup_latitude: {
                type: Sequelize.DECIMAL(10, 8),
                allowNull: false
            },
            pickup_longitude: {
                type: Sequelize.DECIMAL(11, 8),
                allowNull: false
            },
            destination_address: {
                type: Sequelize.TEXT,
                allowNull: false
            },
            destination_latitude: {
                type: Sequelize.DECIMAL(10, 8),
                allowNull: false
            },
            destination_longitude: {
                type: Sequelize.DECIMAL(11, 8),
                allowNull: false
            },
            description: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            service_fee: {
                type: Sequelize.DECIMAL(10, 2),
                allowNull: false
            },
            status: {
                type: Sequelize.ENUM('pending', 'driver_found', 'in_progress', 'completed', 'cancelled'),
                defaultValue: 'pending'
            },
            customer_phone: {
                type: Sequelize.STRING,
                allowNull: false
            },
            driver_phone: {
                type: Sequelize.STRING,
                allowNull: true
            },
            estimated_duration: {
                type: Sequelize.INTEGER,
                allowNull: true
            },
            actual_start_time: {
                type: Sequelize.DATE,
                allowNull: true
            },
            actual_completion_time: {
                type: Sequelize.DATE,
                allowNull: true
            },
            notes: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
            }
        });

        // Add indexes
        await queryInterface.addIndex('service_orders', ['customer_id']);
        await queryInterface.addIndex('service_orders', ['driver_id']);
        await queryInterface.addIndex('service_orders', ['status']);
    },

    down: async (queryInterface) => {
        await queryInterface.dropTable('service_orders');
    }
}; 