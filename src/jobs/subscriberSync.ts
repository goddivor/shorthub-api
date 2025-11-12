import cron from 'node-cron';
import { Channel, ChannelPurpose } from '../models/Channel';
import { YouTubeService } from '../services/youtube.service';
import { pubsub } from '../context';
import { logger } from '../utils/logger';

/**
 * Job qui synchronise le nombre d'abonnés des chaînes de publication
 * avec YouTube tous les jours à 2h du matin
 */
export const startSubscriberSyncJob = () => {
  // Tous les jours à 2h du matin
  cron.schedule('0 2 * * *', async () => {
    logger.info('Running subscriber sync job...');

    try {
      // Récupérer toutes les chaînes de publication
      const publicationChannels = await Channel.find({
        channelPurpose: ChannelPurpose.PUBLICATION,
      });

      logger.info(`Syncing ${publicationChannels.length} publication channels`);

      for (const channel of publicationChannels) {
        try {
          const newSubscriberCount = await YouTubeService.refreshSubscriberCount(
            channel.channelId
          );

          const oldCount = channel.subscriberCount;

          // Ajouter à l'historique
          channel.subscriberHistory.push({
            count: newSubscriberCount,
            date: new Date(),
          });

          channel.subscriberCount = newSubscriberCount;
          await channel.save();

          logger.info(
            `Channel ${channel.username}: ${oldCount} → ${newSubscriberCount} subscribers`
          );

          // Publier la mise à jour via subscription
          pubsub.publish('CHANNEL_SUBSCRIBERS_UPDATED', {
            channelSubscribersUpdated: channel,
            channelId: channel._id.toString(),
          });
        } catch (error) {
          logger.error(`Error syncing channel ${channel.username}:`, error);
          // Continuer avec les autres chaînes
        }
      }

      logger.info('Subscriber sync job completed');
    } catch (error) {
      logger.error('Error in subscriber sync job:', error);
    }
  });

  logger.info('✅ Subscriber sync job scheduled (runs daily at 2 AM)');
};
