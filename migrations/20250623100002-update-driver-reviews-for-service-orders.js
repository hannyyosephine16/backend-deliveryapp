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



        // Tambahkan constraint untuk memastikan salah satu dari order_id atau service_order_id harus ada
        await queryInterface.sequelize.query(`
      ALTER TABLE driver_reviews 
      ADD CONSTRAINT driver_reviews_order_constraint 
      CHECK (order_id IS NOT NULL OR service_order_id IS NOT NULL)
    `);
    },

    down: async (queryInterface, Sequelize) => {
        await queryInterface.sequelize.query(`
      ALTER TABLE driver_reviews 
      DROP CONSTRAINT driver_reviews_order_constraint
    `);

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