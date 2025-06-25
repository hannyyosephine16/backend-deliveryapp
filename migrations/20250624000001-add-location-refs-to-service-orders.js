'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Add location reference columns
        await queryInterface.addColumn('service_orders', 'pickup_location_id', {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
                model: 'master_locations',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL'
        });

        await queryInterface.addColumn('service_orders', 'destination_location_id', {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
                model: 'master_locations',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL'
        });

        // Add indexes for better performance
        await queryInterface.addIndex('service_orders', ['pickup_location_id']);
        await queryInterface.addIndex('service_orders', ['destination_location_id']);
    },

    down: async (queryInterface) => {
        await queryInterface.removeIndex('service_orders', ['pickup_location_id']);
        await queryInterface.removeIndex('service_orders', ['destination_location_id']);
        await queryInterface.removeColumn('service_orders', 'pickup_location_id');
        await queryInterface.removeColumn('service_orders', 'destination_location_id');
    }
}; 