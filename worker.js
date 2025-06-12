require('dotenv').config();
const { orderQueue } = require('./utils/queue');
const { logger } = require('./utils/logger');
const { findDriverInBackground, cleanupQueue } = require('./controllers/orderController');

// Process order queue jobs
orderQueue.process('find-driver', async (job) => {
    const { orderId, storeId } = job.data;
    logger.info(`Memproses order ${orderId} untuk store ${storeId}`);

    try {
        await findDriverInBackground(storeId, orderId);
        logger.info(`Job untuk order ${orderId} selesai`);
    } catch (error) {
        logger.error(`Error processing job for order ${orderId}:`, error);
        await cleanupQueue(orderId);
        throw error;
    }
});

// Handle job completion
orderQueue.on('completed', (job) => {
    logger.info(`Job ${job.id} untuk order ${job.data.orderId} selesai`);
});

// Handle job failure
orderQueue.on('failed', (job, err) => {
    logger.error(`Job ${job.id} untuk order ${job.data.orderId} gagal:`, err);
});

logger.info('Worker started successfully');