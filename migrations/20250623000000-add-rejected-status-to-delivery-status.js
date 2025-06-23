'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Add 'rejected' to delivery_status enum
        await queryInterface.sequelize.query(`
      ALTER TABLE orders 
      MODIFY COLUMN delivery_status ENUM('pending', 'picked_up', 'on_way', 'delivered', 'rejected') 
      DEFAULT 'pending'
    `);
    },

    down: async (queryInterface, Sequelize) => {
        // Remove 'rejected' from delivery_status enum
        await queryInterface.sequelize.query(`
      ALTER TABLE orders 
      MODIFY COLUMN delivery_status ENUM('pending', 'picked_up', 'on_way', 'delivered') 
      DEFAULT 'pending'
    `);
    }
}; 