import { startDeadlineReminderJob } from './deadlineReminder';
import { startSubscriberSyncJob } from './subscriberSync';
import { startCleanupNotificationsJob } from './cleanupNotifications';
import { logger } from '../utils/logger';

/**
 * Démarre tous les jobs cron
 */
export const startAllJobs = () => {
  logger.info('Starting cron jobs...');

  startDeadlineReminderJob();
  startSubscriberSyncJob();
  startCleanupNotificationsJob();

  logger.info('✅ All cron jobs started successfully');
};
