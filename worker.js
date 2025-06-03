const orderQueue = require('./utils/queue');
const logger = require('./utils/logger');

// Delay require controller setelah queue dibuat
process.nextTick(async () => {
    const { findDriverInBackground, cleanupQueue } = require('./controllers/orderController');

    orderQueue.process('find-driver', async (job) => {
        logger.info(`Memproses order ${job.data.orderId} untuk store ${job.data.storeId}`);
        try {
            await findDriverInBackground(job.data.storeId, job.data.orderId);

            // Setelah selesai, hapus job dari queue
            await job.remove();
            logger.info(`Job untuk order ${job.data.orderId} dihapus dari queue`);
        } catch (error) {
            logger.error(`Error processing job for order ${job.data.orderId}:`, error);

            // Jika ada error, tetap hapus job untuk mencegah pengulangan
            await job.remove();
            await cleanupQueue(job.data.orderId);
        }
    });

    // Handle job completion
    orderQueue.on('completed', (job) => {
        logger.info(`Job ${job.id} untuk order ${job.data.orderId} selesai`);
        job.remove();
    });

    // Handle job failure
    orderQueue.on('failed', (job, err) => {
        logger.error(`Job ${job.id} untuk order ${job.data.orderId} gagal:`, err);
        job.remove();
    });
});