import cron from 'node-cron';
import { Video, VideoStatus } from '../models/Video';
import { User } from '../models/User';
import { NotificationService } from '../services/notification.service';
import { logger } from '../utils/logger';

/**
 * Job qui s'exécute toutes les heures pour envoyer des rappels
 * aux vidéastes dont les vidéos arrivent à échéance dans les 24h
 */
export const startDeadlineReminderJob = () => {
  // Toutes les heures
  cron.schedule('0 * * * *', async () => {
    logger.info('Running deadline reminder job...');

    try {
      const now = new Date();
      const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // Trouver les vidéos qui arrivent à échéance dans les 24h
      const upcomingVideos = await Video.find({
        scheduledDate: {
          $gte: now,
          $lte: in24Hours,
        },
        status: {
          $in: [VideoStatus.ASSIGNED, VideoStatus.IN_PROGRESS],
        },
      }).populate('assignedTo');

      logger.info(`Found ${upcomingVideos.length} videos with upcoming deadlines`);

      for (const video of upcomingVideos) {
        if (video.assignedTo && video.scheduledDate) {
          const assignedUser = await User.findById(video.assignedTo);

          if (assignedUser) {
            const hoursRemaining = Math.ceil(
              (video.scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60)
            );

            await NotificationService.notifyDeadlineReminder(
              assignedUser,
              video,
              hoursRemaining
            );

            logger.info(
              `Sent deadline reminder to ${assignedUser.username} for video ${video._id}`
            );
          }
        }
      }

      logger.info('Deadline reminder job completed');
    } catch (error) {
      logger.error('Error in deadline reminder job:', error);
    }
  });

  logger.info('✅ Deadline reminder job scheduled (runs every hour)');
};
