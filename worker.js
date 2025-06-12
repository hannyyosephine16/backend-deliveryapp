require('dotenv').config();
const Queue = require('bull');
const { logger } = require('./utils/logger');
const { checkExpiredRequests, handleRequestTimeout } = require('./utils/backgroundJobs');
const { DriverRequest, Driver, Order } = require('./models');
const { Op } = require('sequelize');

// Redis connection options
const redisConfig = {
    redis: {
        port: process.env.REDIS_PORT || 6379,
        host: process.env.REDIS_HOST || 'localhost',
        password: process.env.REDIS_PASSWORD,
        tls: process.env.REDIS_TLS === 'true' ? {} : undefined
    }
};

// Create background jobs queue
const backgroundJobsQueue = new Queue('background-jobs', redisConfig);
const driverRequestQueue = new Queue('driver-requests', redisConfig);

// Process background jobs queue
backgroundJobsQueue.process('check-expired-requests', async (job) => {
    try {
        logger.info('Processing expired requests check job');
        await checkExpiredRequests();
        logger.info('Completed expired requests check job');
        return { success: true, processedAt: new Date().toISOString() };
    } catch (error) {
        logger.error('Error in expired requests check job:', { error: error.message, stack: error.stack });
        throw error;
    }
});

// Process driver request queue for timeout handling
driverRequestQueue.process('handle-timeout', async (job) => {
    try {
        const { requestId } = job.data;
        logger.info('Processing driver request timeout:', { requestId });

        const driverRequest = await DriverRequest.findByPk(requestId, {
            include: [{ model: Order, as: 'order' }]
        });

        if (driverRequest && driverRequest.status === 'pending') {
            await handleRequestTimeout(driverRequest);
            logger.info('Completed driver request timeout handling:', { requestId });
            return { success: true, requestId, processedAt: new Date().toISOString() };
        } else {
            logger.info('Driver request already processed or not found:', { requestId });
            return { success: true, skipped: true, requestId };
        }
    } catch (error) {
        logger.error('Error in driver request timeout job:', { error: error.message, stack: error.stack });
        throw error;
    }
});

// Error handling
backgroundJobsQueue.on('error', (error) => {
    logger.error('Background jobs queue error:', error);
});

driverRequestQueue.on('error', (error) => {
    logger.error('Driver request queue error:', error);
});

backgroundJobsQueue.on('failed', (job, err) => {
    logger.error('Background job failed:', { jobId: job.id, jobData: job.data, error: err.message });
});

driverRequestQueue.on('failed', (job, err) => {
    logger.error('Driver request job failed:', { jobId: job.id, jobData: job.data, error: err.message });
});

// Success logging
backgroundJobsQueue.on('completed', (job, result) => {
    logger.info('Background job completed:', { jobId: job.id, result });
});

driverRequestQueue.on('completed', (job, result) => {
    logger.info('Driver request job completed:', { jobId: job.id, result });
});

// Worker management functions
const workerManager = {
    // Schedule recurring expired requests check
    async scheduleExpiredRequestsCheck() {
        try {
            // Remove existing scheduled jobs to avoid duplicates
            await backgroundJobsQueue.clean(0, 'delayed');

            // Schedule to run every minute
            const job = await backgroundJobsQueue.add(
                'check-expired-requests',
                {},
                {
                    repeat: { cron: '* * * * *' }, // Every minute
                    removeOnComplete: 10, // Keep last 10 completed jobs
                    removeOnFail: 5 // Keep last 5 failed jobs
                }
            );

            logger.info('Scheduled expired requests check job:', { jobId: job.id });
            return job;
        } catch (error) {
            logger.error('Error scheduling expired requests check:', error);
            throw error;
        }
    },

    // Schedule driver request timeout
    async scheduleDriverRequestTimeout(requestId, delayMinutes = 15) {
        try {
            const job = await driverRequestQueue.add(
                'handle-timeout',
                { requestId },
                {
                    delay: delayMinutes * 60 * 1000, // Convert minutes to milliseconds
                    removeOnComplete: 5,
                    removeOnFail: 3
                }
            );

            logger.info('Scheduled driver request timeout:', { requestId, delayMinutes, jobId: job.id });
            return job;
        } catch (error) {
            logger.error('Error scheduling driver request timeout:', { requestId, error: error.message });
            throw error;
        }
    },

    // Cancel driver request timeout
    async cancelDriverRequestTimeout(requestId) {
        try {
            const jobs = await driverRequestQueue.getJobs(['delayed', 'waiting']);
            const targetJob = jobs.find(job =>
                job.data.requestId === requestId &&
                job.opts.jobId === `timeout-${requestId}`
            );

            if (targetJob) {
                await targetJob.remove();
                logger.info('Cancelled driver request timeout:', { requestId, jobId: targetJob.id });
                return true;
            }

            logger.info('No timeout job found to cancel:', { requestId });
            return false;
        } catch (error) {
            logger.error('Error cancelling driver request timeout:', { requestId, error: error.message });
            throw error;
        }
    },

    // Get worker status
    async getWorkerStatus() {
        try {
            const [backgroundStatus, driverRequestStatus] = await Promise.all([
                backgroundJobsQueue.getJobCounts(),
                driverRequestQueue.getJobCounts()
            ]);

            return {
                backgroundJobs: backgroundStatus,
                driverRequests: driverRequestStatus,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error('Error getting worker status:', error);
            throw error;
        }
    },

    // Initialize all background jobs
    async initializeBackgroundJobs() {
        try {
            logger.info('Initializing background jobs with queue system...');

            // Schedule expired requests check
            await this.scheduleExpiredRequestsCheck();

            logger.info('Background jobs initialized successfully with queues');
            return true;
        } catch (error) {
            logger.error('Error initializing background jobs:', error);
            throw error;
        }
    },

    // Graceful shutdown
    async shutdown() {
        try {
            logger.info('Shutting down worker queues...');

            await Promise.all([
                backgroundJobsQueue.close(),
                driverRequestQueue.close()
            ]);

            logger.info('Worker queues shut down successfully');
        } catch (error) {
            logger.error('Error shutting down worker queues:', error);
            throw error;
        }
    }
};

// Handle graceful shutdown
process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down worker gracefully...');
    await workerManager.shutdown();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down worker gracefully...');
    await workerManager.shutdown();
    process.exit(0);
});

// Export for use in other files
module.exports = {
    backgroundJobsQueue,
    driverRequestQueue,
    workerManager
};

// If this file is run directly, start the worker
if (require.main === module) {
    logger.info('Starting DelPick background worker...');

    workerManager.initializeBackgroundJobs()
        .then(() => {
            logger.info('DelPick background worker started successfully');
        })
        .catch((error) => {
            logger.error('Failed to start background worker:', error);
            process.exit(1);
        });
}