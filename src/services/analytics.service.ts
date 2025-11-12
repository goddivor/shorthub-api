import { User, UserRole } from '../models/User';
import { Channel, ChannelPurpose } from '../models/Channel';
import { Video, VideoStatus } from '../models/Video';

export class AnalyticsService {
  /**
   * Récupère les analytics complètes du dashboard admin
   */
  static async getDashboardAnalytics() {
    // Compteurs globaux
    const [
      totalChannels,
      totalSourceChannels,
      totalPublicationChannels,
      totalVideos,
      totalUsers,
    ] = await Promise.all([
      Channel.countDocuments(),
      Channel.countDocuments({ channelPurpose: ChannelPurpose.SOURCE }),
      Channel.countDocuments({ channelPurpose: ChannelPurpose.PUBLICATION }),
      Video.countDocuments(),
      User.countDocuments(),
    ]);

    // Vidéos par statut
    const [
      videosRolled,
      videosAssigned,
      videosInProgress,
      videosCompleted,
      videosValidated,
      videosPublished,
      videosRejected,
    ] = await Promise.all([
      Video.countDocuments({ status: VideoStatus.ROLLED }),
      Video.countDocuments({ status: VideoStatus.ASSIGNED }),
      Video.countDocuments({ status: VideoStatus.IN_PROGRESS }),
      Video.countDocuments({ status: VideoStatus.COMPLETED }),
      Video.countDocuments({ status: VideoStatus.VALIDATED }),
      Video.countDocuments({ status: VideoStatus.PUBLISHED }),
      Video.countDocuments({ status: VideoStatus.REJECTED }),
    ]);

    // Vidéos en retard
    const videosLate = await Video.countDocuments({
      scheduledDate: { $lt: new Date() },
      status: {
        $nin: [VideoStatus.COMPLETED, VideoStatus.VALIDATED, VideoStatus.PUBLISHED],
      },
    });

    // Vidéos complétées les 7 derniers jours
    const videosCompletedLast7Days = await this.getVideoCountsByDay(7);

    // Vidéos complétées les 30 derniers jours
    const videosCompletedLast30Days = await this.getVideoCountsByDay(30);

    // Temps moyen de complétion (en heures)
    const completionTimeResult = await Video.aggregate([
      {
        $match: {
          completedAt: { $exists: true },
          assignedAt: { $exists: true },
        },
      },
      {
        $project: {
          completionTime: {
            $divide: [{ $subtract: ['$completedAt', '$assignedAt'] }, 3600000],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgTime: { $avg: '$completionTime' },
        },
      },
    ]);

    const averageCompletionTime =
      completionTimeResult.length > 0 ? completionTimeResult[0].avgTime : 0;

    // Taux de complétion
    const totalAssigned = await Video.countDocuments({
      status: { $ne: VideoStatus.ROLLED },
    });
    const totalCompleted = await Video.countDocuments({
      status: { $in: [VideoStatus.COMPLETED, VideoStatus.VALIDATED, VideoStatus.PUBLISHED] },
    });
    const completionRate = totalAssigned > 0 ? (totalCompleted / totalAssigned) * 100 : 0;

    // Top vidéastes
    const topVideastes = await this.getTopVideastes();

    // Croissance des abonnés
    const totalSubscribers = await this.getTotalSubscribers();
    const subscriberGrowthLast30Days = await this.getSubscriberGrowth(30);
    const channelsGrowth = await this.getChannelsGrowth();

    return {
      totalChannels,
      totalSourceChannels,
      totalPublicationChannels,
      totalVideos,
      totalUsers,
      videosRolled,
      videosAssigned,
      videosInProgress,
      videosCompleted,
      videosValidated,
      videosPublished,
      videosRejected,
      videosLate,
      videosCompletedLast7Days,
      videosCompletedLast30Days,
      averageCompletionTime,
      completionRate,
      topVideastes,
      totalSubscribers,
      subscriberGrowthLast30Days,
      channelsGrowth,
    };
  }

  /**
   * Compte les vidéos complétées par jour sur N jours
   */
  private static async getVideoCountsByDay(days: number) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const result = await Video.aggregate([
      {
        $match: {
          completedAt: { $gte: startDate },
          status: {
            $in: [VideoStatus.COMPLETED, VideoStatus.VALIDATED, VideoStatus.PUBLISHED],
          },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$completedAt' },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // Remplir les jours manquants avec 0
    const counts: { date: string; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const found = result.find((r) => r._id === dateStr);
      counts.push({
        date: dateStr,
        count: found ? found.count : 0,
      });
    }

    return counts;
  }

  /**
   * Récupère les top vidéastes par performance
   */
  private static async getTopVideastes() {
    const videaastes = await User.find({ role: UserRole.VIDEASTE }).limit(10);

    const performances = await Promise.all(
      videaastes.map(async (videaste) => {
        const totalAssigned = await Video.countDocuments({ assignedTo: videaste._id });
        const totalCompleted = await Video.countDocuments({
          assignedTo: videaste._id,
          status: {
            $in: [VideoStatus.COMPLETED, VideoStatus.VALIDATED, VideoStatus.PUBLISHED],
          },
        });

        const completionRate = totalAssigned > 0 ? (totalCompleted / totalAssigned) * 100 : 0;

        // Temps moyen de complétion
        const timeResult = await Video.aggregate([
          {
            $match: {
              assignedTo: videaste._id,
              completedAt: { $exists: true },
              assignedAt: { $exists: true },
            },
          },
          {
            $project: {
              time: { $divide: [{ $subtract: ['$completedAt', '$assignedAt'] }, 3600000] },
            },
          },
          {
            $group: {
              _id: null,
              avgTime: { $avg: '$time' },
            },
          },
        ]);

        const averageTime = timeResult.length > 0 ? timeResult[0].avgTime : 0;

        return {
          user: videaste,
          videosCompleted: totalCompleted,
          completionRate,
          averageTime,
        };
      })
    );

    // Trier par nombre de vidéos complétées
    return performances.sort((a, b) => b.videosCompleted - a.videosCompleted);
  }

  /**
   * Calcule le nombre total d'abonnés sur toutes les chaînes de publication
   */
  private static async getTotalSubscribers(): Promise<number> {
    const result = await Channel.aggregate([
      {
        $match: { channelPurpose: ChannelPurpose.PUBLICATION },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$subscriberCount' },
        },
      },
    ]);

    return result.length > 0 ? result[0].total : 0;
  }

  /**
   * Calcule la croissance des abonnés sur N jours
   */
  private static async getSubscriberGrowth(days: number): Promise<number> {
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - days);

    const channels = await Channel.find({ channelPurpose: ChannelPurpose.PUBLICATION });

    let totalGrowth = 0;

    for (const channel of channels) {
      const history = channel.subscriberHistory || [];
      const oldEntry = history.find((entry) => entry.date <= dateThreshold);

      if (oldEntry) {
        totalGrowth += channel.subscriberCount - oldEntry.count;
      }
    }

    return totalGrowth;
  }

  /**
   * Récupère la croissance par chaîne
   */
  private static async getChannelsGrowth() {
    const channels = await Channel.find({ channelPurpose: ChannelPurpose.PUBLICATION });

    const growthData = channels.map((channel) => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const history = channel.subscriberHistory || [];
      const oldEntry = history.find((entry) => entry.date <= thirtyDaysAgo);

      const growth30Days = oldEntry ? channel.subscriberCount - oldEntry.count : 0;
      const growthRate =
        oldEntry && oldEntry.count > 0 ? (growth30Days / oldEntry.count) * 100 : 0;

      return {
        channel,
        subscriberCount: channel.subscriberCount,
        growth30Days,
        growthRate,
      };
    });

    // Trier par croissance absolue
    return growthData.sort((a, b) => b.growth30Days - a.growth30Days);
  }

  /**
   * Statistiques d'un utilisateur spécifique
   */
  static async getUserStats(userId: string) {
    const totalVideosAssigned = await Video.countDocuments({ assignedTo: userId });

    const totalVideosCompleted = await Video.countDocuments({
      assignedTo: userId,
      status: { $in: [VideoStatus.COMPLETED, VideoStatus.VALIDATED, VideoStatus.PUBLISHED] },
    });

    const totalVideosInProgress = await Video.countDocuments({
      assignedTo: userId,
      status: VideoStatus.IN_PROGRESS,
    });

    const completionRate =
      totalVideosAssigned > 0 ? (totalVideosCompleted / totalVideosAssigned) * 100 : 0;

    // Temps moyen de complétion
    const timeResult = await Video.aggregate([
      {
        $match: {
          assignedTo: userId,
          completedAt: { $exists: true },
          assignedAt: { $exists: true },
        },
      },
      {
        $project: {
          time: { $divide: [{ $subtract: ['$completedAt', '$assignedAt'] }, 3600000] },
        },
      },
      {
        $group: {
          _id: null,
          avgTime: { $avg: '$time' },
        },
      },
    ]);

    const averageCompletionTime = timeResult.length > 0 ? timeResult[0].avgTime : null;

    // Vidéos complétées ce mois
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const videosCompletedThisMonth = await Video.countDocuments({
      assignedTo: userId,
      completedAt: { $gte: startOfMonth },
    });

    // Vidéos en retard
    const videosLate = await Video.countDocuments({
      assignedTo: userId,
      scheduledDate: { $lt: new Date() },
      status: {
        $nin: [VideoStatus.COMPLETED, VideoStatus.VALIDATED, VideoStatus.PUBLISHED],
      },
    });

    // Vidéos à temps
    const videosOnTime = totalVideosCompleted - videosLate;

    return {
      totalVideosAssigned,
      totalVideosCompleted,
      totalVideosInProgress,
      completionRate,
      averageCompletionTime,
      videosCompletedThisMonth,
      videosLate,
      videosOnTime,
    };
  }

  /**
   * Statistiques d'une chaîne spécifique
   */
  static async getChannelStats(channelId: string) {
    const channel = await Channel.findById(channelId);

    if (!channel) {
      throw new Error('Channel not found');
    }

    const totalVideosRolled = await Video.countDocuments({ sourceChannelId: channelId });

    const totalVideosPublished = await Video.countDocuments({
      publicationChannelId: channelId,
      status: VideoStatus.PUBLISHED,
    });

    // Croissance des abonnés
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const history = channel.subscriberHistory || [];
    const oldEntry = history.find((entry) => entry.date <= thirtyDaysAgo);

    const subscriberGrowthLast30Days = oldEntry
      ? channel.subscriberCount - oldEntry.count
      : 0;

    const subscriberGrowthRate =
      oldEntry && oldEntry.count > 0
        ? (subscriberGrowthLast30Days / oldEntry.count) * 100
        : 0;

    return {
      totalVideosRolled,
      totalVideosPublished,
      subscriberGrowthLast30Days,
      subscriberGrowthRate,
    };
  }
}
