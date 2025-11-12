import cron from 'node-cron';
import { Notification } from '../models/Notification';
import { logger } from '../utils/logger';

/**
 * Job qui nettoie les notifications lues de plus de 30 jours
 * S'exécute tous les dimanches à 3h du matin
 */
export const startCleanupNotificationsJob = () => {
  // Tous les dimanches à 3h du matin
  cron.schedule('0 3 * * 0', async () => {
    logger.info('Running cleanup notifications job...');

    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await Notification.deleteMany({
        read: true,
        readAt: { $lt: thirtyDaysAgo },
      });

      logger.info(`Deleted ${result.deletedCount} old read notifications`);
      logger.info('Cleanup notifications job completed');
    } catch (error) {
      logger.error('Error in cleanup notifications job:', error);
    }
  });

  logger.info('✅ Cleanup notifications job scheduled (runs weekly on Sundays at 3 AM)');
};
