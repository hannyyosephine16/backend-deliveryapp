'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.addColumn('driver_reviews', 'service_order_id', {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
                model: 'service_orders',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
        });

        // Ubah order_id menjadi nullable
        await queryInterface.changeColumn('driver_reviews', 'order_id', {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
                model: 'orders',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
        });
    },

    down: async (queryInterface, Sequelize) => {
        // Kembalikan order_id menjadi not null
        await queryInterface.changeColumn('driver_reviews', 'order_id', {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
                model: 'orders',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE'
        });

        await queryInterface.removeColumn('driver_reviews', 'service_order_id');
    }
}; 