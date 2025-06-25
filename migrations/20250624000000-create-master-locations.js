'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.createTable('master_locations', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            name: {
                type: Sequelize.STRING,
                allowNull: false,
                unique: true
            },
            latitude: {
                type: Sequelize.DECIMAL(10, 8),
                allowNull: false
            },
            longitude: {
                type: Sequelize.DECIMAL(11, 8),
                allowNull: false
            },
            service_fee: {
                type: Sequelize.DECIMAL(10, 2),
                allowNull: false
            },
            estimated_duration_minutes: {
                type: Sequelize.INTEGER,
                allowNull: false
            },
            is_active: {
                type: Sequelize.BOOLEAN,
                defaultValue: true
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
        await queryInterface.addIndex('master_locations', ['name']);
        await queryInterface.addIndex('master_locations', ['is_active']);

        // Insert initial data - Daerah Toba saja dengan harga tetap
        await queryInterface.bulkInsert('master_locations', [
            {
                name: 'Balige',
                latitude: 2.3334,
                longitude: 99.0667,
                service_fee: 25000,
                estimated_duration_minutes: 45,
                is_active: true,
                created_at: new Date(),
                updated_at: new Date()
            },
            {
                name: 'Laguboti',
                latitude: 2.5167,
                longitude: 99.2833,
                service_fee: 15000,
                estimated_duration_minutes: 25,
                is_active: true,
                created_at: new Date(),
                updated_at: new Date()
            },
            {
                name: 'Parapat',
                latitude: 2.6667,
                longitude: 98.9333,
                service_fee: 20000,
                estimated_duration_minutes: 30,
                is_active: true,
                created_at: new Date(),
                updated_at: new Date()
            },
            {
                name: 'Samosir',
                latitude: 2.5833,
                longitude: 98.8333,
                service_fee: 30000,
                estimated_duration_minutes: 60,
                is_active: true,
                created_at: new Date(),
                updated_at: new Date()
            },
            {
                name: 'Sitoluama',
                latitude: 2.3500,
                longitude: 99.1500,
                service_fee: 10000,
                estimated_duration_minutes: 15,
                is_active: true,
                created_at: new Date(),
                updated_at: new Date()
            }
        ]);
    },

    down: async (queryInterface) => {
        await queryInterface.dropTable('master_locations');
    }
}; 