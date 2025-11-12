import { Query } from './Query';
import { Mutation } from './Mutation';
import { Subscription } from './Subscription';
import { DateTimeScalar } from '../scalars/DateTime';
import { JSONScalar } from '../scalars/JSON';
import { User } from '../../models/User';
import { Channel } from '../../models/Channel';
import { Video, VideoStatus } from '../../models/Video';
import { VideoComment } from '../../models/VideoComment';
import { Notification } from '../../models/Notification';

export const resolvers = {
  DateTime: DateTimeScalar,
  JSON: JSONScalar,

  Query,
  Mutation,
  Subscription,

  // Type resolvers
  User: {
    createdBy: async (parent: any, _: any, context: any) => {
      if (!parent.createdBy) return null;
      return context.dataloaders.userLoader.load(parent.createdBy.toString());
    },
    assignedTo: async (parent: any, _: any, context: any) => {
      if (!parent.assignedTo) return null;
      return context.dataloaders.userLoader.load(parent.assignedTo.toString());
    },
    videosAssigned: async (parent: any) => {
      return await Video.find({ assignedTo: parent._id });
    },
    publicationChannels: async (parent: any) => {
      return await Channel.find({ ownedBy: parent._id });
    },
    stats: async (parent: any) => {
      const totalVideosAssigned = await Video.countDocuments({ assignedTo: parent._id });
      const totalVideosCompleted = await Video.countDocuments({
        assignedTo: parent._id,
        status: { $in: [VideoStatus.COMPLETED, VideoStatus.VALIDATED, VideoStatus.PUBLISHED] },
      });
      const totalVideosInProgress = await Video.countDocuments({
        assignedTo: parent._id,
        status: VideoStatus.IN_PROGRESS,
      });

      const completionRate =
        totalVideosAssigned > 0 ? (totalVideosCompleted / totalVideosAssigned) * 100 : 0;

      // Videos completed this month
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const videosCompletedThisMonth = await Video.countDocuments({
        assignedTo: parent._id,
        completedAt: { $gte: startOfMonth },
      });

      // Videos late
      const videosLate = await Video.countDocuments({
        assignedTo: parent._id,
        scheduledDate: { $lt: new Date() },
        status: { $nin: [VideoStatus.COMPLETED, VideoStatus.VALIDATED, VideoStatus.PUBLISHED] },
      });

      return {
        totalVideosAssigned,
        totalVideosCompleted,
        totalVideosInProgress,
        completionRate,
        averageCompletionTime: null, // TODO: Calculate
        videosCompletedThisMonth,
        videosLate,
        videosOnTime: totalVideosCompleted - videosLate,
      };
    },
  },

  Channel: {
    ownedBy: async (parent: any, _: any, context: any) => {
      if (!parent.ownedBy) return null;
      return context.dataloaders.userLoader.load(parent.ownedBy.toString());
    },
    videosFromChannel: async (parent: any) => {
      return await Video.find({ sourceChannelId: parent._id });
    },
    videosToChannel: async (parent: any) => {
      return await Video.find({ publicationChannelId: parent._id });
    },
    stats: async (parent: any) => {
      const totalVideosRolled = await Video.countDocuments({ sourceChannelId: parent._id });
      const totalVideosPublished = await Video.countDocuments({
        publicationChannelId: parent._id,
        status: VideoStatus.PUBLISHED,
      });

      // Subscriber growth
      const subscriberHistory = parent.subscriberHistory || [];
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const oldEntry = subscriberHistory.find((entry: any) => entry.date <= thirtyDaysAgo);
      const subscriberGrowthLast30Days = oldEntry
        ? parent.subscriberCount - oldEntry.count
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
    },
  },

  Video: {
    sourceChannel: async (parent: any, _: any, context: any) => {
      return context.dataloaders.channelLoader.load(parent.sourceChannelId.toString());
    },
    assignedTo: async (parent: any, _: any, context: any) => {
      if (!parent.assignedTo) return null;
      return context.dataloaders.userLoader.load(parent.assignedTo.toString());
    },
    assignedBy: async (parent: any, _: any, context: any) => {
      if (!parent.assignedBy) return null;
      return context.dataloaders.userLoader.load(parent.assignedBy.toString());
    },
    publicationChannel: async (parent: any, _: any, context: any) => {
      if (!parent.publicationChannelId) return null;
      return context.dataloaders.channelLoader.load(parent.publicationChannelId.toString());
    },
    comments: async (parent: any) => {
      return await VideoComment.find({ videoId: parent._id });
    },
    notifications: async (parent: any) => {
      return await Notification.find({ videoId: parent._id });
    },
    isLate: (parent: any) => {
      if (!parent.scheduledDate || parent.status === VideoStatus.PUBLISHED) {
        return false;
      }
      return new Date() > parent.scheduledDate && parent.status !== VideoStatus.VALIDATED;
    },
    daysUntilDeadline: (parent: any) => {
      if (!parent.scheduledDate) return null;
      const now = new Date();
      const scheduled = new Date(parent.scheduledDate);
      const diffTime = scheduled.getTime() - now.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    },
    timeToComplete: (parent: any) => {
      if (!parent.completedAt || !parent.assignedAt) return null;
      const diffTime = parent.completedAt.getTime() - parent.assignedAt.getTime();
      return diffTime / (1000 * 60 * 60); // Hours
    },
  },

  VideoComment: {
    video: async (parent: any, _: any, context: any) => {
      return context.dataloaders.videoLoader.load(parent.videoId.toString());
    },
    author: async (parent: any, _: any, context: any) => {
      return context.dataloaders.userLoader.load(parent.authorId.toString());
    },
  },

  Notification: {
    recipient: async (parent: any, _: any, context: any) => {
      return context.dataloaders.userLoader.load(parent.recipientId.toString());
    },
    video: async (parent: any, _: any, context: any) => {
      if (!parent.videoId) return null;
      return context.dataloaders.videoLoader.load(parent.videoId.toString());
    },
  },
};
