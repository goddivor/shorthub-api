import { Query } from './Query';
import { Mutation } from './Mutation';
import { Subscription } from './Subscription';
import { IUser } from '../../models/User';
import { GraphQLContext } from '../../context';
import { DateTimeScalar } from '../scalars/DateTime';
import { JSONScalar } from '../scalars/JSON';
import { Channel, IChannel } from '../../models/Channel';
import { Video, VideoStatus, IVideo } from '../../models/Video';
import { VideoComment, IVideoComment } from '../../models/VideoComment';
import { Notification, INotification } from '../../models/Notification';
import { SourceChannelResolvers } from './SourceChannel';
import { AdminChannelResolvers } from './AdminChannel';
import { ShortResolvers } from './Short';
import { GoogleDriveResolvers } from './GoogleDrive';

export const resolvers = {
  DateTime: DateTimeScalar,
  JSON: JSONScalar,

  Query: {
    ...Query,
    ...SourceChannelResolvers.Query,
    ...AdminChannelResolvers.Query,
    ...ShortResolvers.Query,
    ...GoogleDriveResolvers.Query,
  },

  Mutation: {
    ...Mutation,
    ...SourceChannelResolvers.Mutation,
    ...AdminChannelResolvers.Mutation,
    ...ShortResolvers.Mutation,
    ...GoogleDriveResolvers.Mutation,
  },

  Subscription,

  // Type resolvers - Nouveaux types
  SourceChannel: SourceChannelResolvers.SourceChannel,
  AdminChannel: AdminChannelResolvers.AdminChannel,
  Short: ShortResolvers.Short,

  // Type resolvers - Anciens types
  User: {
    createdBy: async (parent: IUser, _: unknown, context: GraphQLContext) => {
      if (!parent.createdBy) return null;
      return context.dataloaders.userLoader.load(parent.createdBy.toString());
    },
    assignedTo: async (parent: IUser, _: unknown, context: GraphQLContext) => {
      if (!parent.assignedTo) return null;
      return context.dataloaders.userLoader.load(parent.assignedTo.toString());
    },
    videosAssigned: async (parent: IUser) => {
      return await Video.find({ assignedTo: parent._id });
    },
    publicationChannels: async (parent: IUser) => {
      return await Channel.find({ ownedBy: parent._id });
    },
    stats: async (parent: IUser) => {
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
    ownedBy: async (parent: IChannel, _: unknown, context: GraphQLContext) => {
      if (!parent.ownedBy) return null;
      return context.dataloaders.userLoader.load(parent.ownedBy.toString());
    },
    videosFromChannel: async (parent: IChannel) => {
      return await Video.find({ sourceChannelId: parent._id });
    },
    videosToChannel: async (parent: IChannel) => {
      return await Video.find({ publicationChannelId: parent._id });
    },
    stats: async (parent: IChannel) => {
      const totalVideosRolled = await Video.countDocuments({ sourceChannelId: parent._id });
      const totalVideosPublished = await Video.countDocuments({
        publicationChannelId: parent._id,
        status: VideoStatus.PUBLISHED,
      });

      // Subscriber growth
      const subscriberHistory = parent.subscriberHistory || [];
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const oldEntry = subscriberHistory.find((entry: { date: Date; count: number }) => entry.date <= thirtyDaysAgo);
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
    sourceChannel: async (parent: IVideo, _: unknown, context: GraphQLContext) => {
      return context.dataloaders.channelLoader.load(parent.sourceChannelId.toString());
    },
    assignedTo: async (parent: IVideo, _: unknown, context: GraphQLContext) => {
      if (!parent.assignedTo) return null;
      return context.dataloaders.userLoader.load(parent.assignedTo.toString());
    },
    assignedBy: async (parent: IVideo, _: unknown, context: GraphQLContext) => {
      if (!parent.assignedBy) return null;
      return context.dataloaders.userLoader.load(parent.assignedBy.toString());
    },
    publicationChannel: async (parent: IVideo, _: unknown, context: GraphQLContext) => {
      if (!parent.publicationChannelId) return null;
      return context.dataloaders.channelLoader.load(parent.publicationChannelId.toString());
    },
    comments: async (parent: IVideo) => {
      return await VideoComment.find({ videoId: parent._id });
    },
    notifications: async (parent: IVideo) => {
      return await Notification.find({ videoId: parent._id });
    },
    isLate: (parent: IVideo) => {
      if (!parent.scheduledDate) {
        return false;
      }
      // Statuts où le travail n'est pas encore terminé
      const incompletedStatuses = [VideoStatus.ASSIGNED, VideoStatus.IN_PROGRESS];
      if (!incompletedStatuses.includes(parent.status)) {
        return false;
      }
      return new Date() > parent.scheduledDate;
    },
    daysUntilDeadline: (parent: IVideo) => {
      if (!parent.scheduledDate) return null;
      const now = new Date();
      const scheduled = new Date(parent.scheduledDate);
      const diffTime = scheduled.getTime() - now.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    },
    timeToComplete: (parent: IVideo) => {
      if (!parent.completedAt || !parent.assignedAt) return null;
      const diffTime = parent.completedAt.getTime() - parent.assignedAt.getTime();
      return diffTime / (1000 * 60 * 60); // Hours
    },
  },

  VideoComment: {
    video: async (parent: IVideoComment, _: unknown, context: GraphQLContext) => {
      return context.dataloaders.videoLoader.load(parent.videoId.toString());
    },
    author: async (parent: IVideoComment, _: unknown, context: GraphQLContext) => {
      return context.dataloaders.userLoader.load(parent.authorId.toString());
    },
  },

  Notification: {
    recipient: async (parent: INotification, _: unknown, context: GraphQLContext) => {
      return context.dataloaders.userLoader.load(parent.recipientId.toString());
    },
    short: async (parent: INotification, _: unknown, context: GraphQLContext) => {
      if (!parent.videoId) return null;
      return context.dataloaders.videoLoader.load(parent.videoId.toString());
    },
  },
};
