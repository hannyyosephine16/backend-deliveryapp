const Queue = require('bull');
const logger = require('./logger').logger;

// Create queues
const orderQueue = new Queue('order-processing', process.env.REDIS_URL || 'redis://localhost:6379');
const driverQueue = new Queue('driver-assignment', process.env.REDIS_URL || 'redis://localhost:6379');

// Process order queue
orderQueue.process(async (job) => {
    const { orderId, action } = job.data;
    logger.info(`Processing order ${orderId}: ${action}`);

    try {
        switch (action) {
            case 'find-driver':
                // Logic to find available drivers
                break;
            case 'check-status':
                // Logic to check order status
                break;
            case 'cleanup':
                // Logic to cleanup expired orders
                break;
            default:
                logger.warn(`Unknown order action: ${action}`);
        }
    } catch (error) {
        logger.error(`Error processing order ${orderId}:`, error);
        throw error;
    }
});

// Process driver queue
driverQueue.process(async (job) => {
    const { driverId, action } = job.data;
    logger.info(`Processing driver ${driverId}: ${action}`);

    try {
        switch (action) {
            case 'check-availability':
                // Logic to check driver availability
                break;
            case 'update-location':
                // Logic to update driver location
                break;
            default:
                logger.warn(`Unknown driver action: ${action}`);
        }
    } catch (error) {
        logger.error(`Error processing driver ${driverId}:`, error);
        throw error;
    }
});

// Error handling
orderQueue.on('error', (error) => {
    logger.error('Order queue error:', error);
});

driverQueue.on('error', (error) => {
    logger.error('Driver queue error:', error);
});

// Queue management functions
const queueManager = {
    // Add order job
    async addOrderJob(orderId, action, options = {}) {
        return orderQueue.add({ orderId, action }, options);
    },

    // Add driver job
    async addDriverJob(driverId, action, options = {}) {
        return driverQueue.add({ driverId, action }, options);
    },

    // Get queue status
    async getQueueStatus() {
        const [orderStatus, driverStatus] = await Promise.all([
            orderQueue.getJobCounts(),
            driverQueue.getJobCounts()
        ]);

        return {
            order: orderStatus,
            driver: driverStatus
        };
    }
};

module.exports = queueManager;