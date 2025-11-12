import { GraphQLContext } from '../../context';
import { requireAuth, requireRole } from '../../middlewares/auth';
import { User, UserRole } from '../../models/User';
import { Channel } from '../../models/Channel';
import { Video } from '../../models/Video';
import { Notification } from '../../models/Notification';
import { ActivityLog } from '../../models/ActivityLog';
import { AnalyticsService } from '../../services/analytics.service';

export const Query = {
  // Auth
  me: async (_: any, __: any, context: GraphQLContext) => {
    const user = requireAuth(context);
    return user;
  },

  // Users
  users: async (_: any, args: any, context: GraphQLContext) => {
    requireRole(context, [UserRole.ADMIN]);

    const { first = 20, after, role, status } = args;
    const filter: any = {};

    if (role) filter.role = role;
    if (status) filter.status = status;

    const query = User.find(filter).limit(first);

    if (after) {
      query.skip(parseInt(after));
    }

    const users = await query;
    const totalCount = await User.countDocuments(filter);

    return {
      edges: users.map((user, index) => ({
        cursor: (after ? parseInt(after) + index : index).toString(),
        node: user,
      })),
      pageInfo: {
        hasNextPage: users.length === first,
        hasPreviousPage: !!after && parseInt(after) > 0,
      },
      totalCount,
    };
  },

  user: async (_: any, { id }: any, context: GraphQLContext) => {
    requireAuth(context);
    return await User.findById(id);
  },

  // Channels
  channels: async (_: any, args: any, context: GraphQLContext) => {
    requireAuth(context);

    const { first = 20, after, purpose, language, country } = args;
    const filter: any = {};

    if (purpose) filter.channelPurpose = purpose;
    if (language) filter.language = language;
    if (country) filter.country = country;

    const query = Channel.find(filter).limit(first);

    if (after) {
      query.skip(parseInt(after));
    }

    const channels = await query;
    const totalCount = await Channel.countDocuments(filter);

    return {
      edges: channels.map((channel, index) => ({
        cursor: (after ? parseInt(after) + index : index).toString(),
        node: channel,
      })),
      pageInfo: {
        hasNextPage: channels.length === first,
        hasPreviousPage: !!after && parseInt(after) > 0,
      },
      totalCount,
    };
  },

  channel: async (_: any, { id }: any, context: GraphQLContext) => {
    requireAuth(context);
    return await Channel.findById(id);
  },

  // Videos
  videos: async (_: any, args: any, context: GraphQLContext) => {
    requireAuth(context);

    const { first = 20, after, filter } = args;
    const query: any = {};

    if (filter) {
      if (filter.status) query.status = filter.status;
      if (filter.assignedToId) query.assignedTo = filter.assignedToId;
      if (filter.sourceChannelId) query.sourceChannelId = filter.sourceChannelId;
      if (filter.publicationChannelId) query.publicationChannelId = filter.publicationChannelId;
      if (filter.startDate || filter.endDate) {
        query.scheduledDate = {};
        if (filter.startDate) query.scheduledDate.$gte = filter.startDate;
        if (filter.endDate) query.scheduledDate.$lte = filter.endDate;
      }
    }

    const videoQuery = Video.find(query).limit(first);

    if (after) {
      videoQuery.skip(parseInt(after));
    }

    const videos = await videoQuery;
    const totalCount = await Video.countDocuments(query);

    return {
      edges: videos.map((video, index) => ({
        cursor: (after ? parseInt(after) + index : index).toString(),
        node: video,
      })),
      pageInfo: {
        hasNextPage: videos.length === first,
        hasPreviousPage: !!after && parseInt(after) > 0,
      },
      totalCount,
    };
  },

  video: async (_: any, { id }: any, context: GraphQLContext) => {
    requireAuth(context);
    return await Video.findById(id);
  },

  // Calendar
  calendarVideos: async (_: any, args: any, context: GraphQLContext) => {
    const user = requireAuth(context);
    const { startDate, endDate, userId } = args;

    const query: any = {
      scheduledDate: {
        $gte: startDate,
        $lte: endDate,
      },
    };

    // Si l'utilisateur n'est pas admin, il ne voit que ses vidéos
    if (user.role !== UserRole.ADMIN) {
      query.assignedTo = user._id;
    } else if (userId) {
      query.assignedTo = userId;
    }

    return await Video.find(query).sort({ scheduledDate: 1 });
  },

  // Notifications
  notifications: async (_: any, args: any, context: GraphQLContext) => {
    const user = requireAuth(context);
    const { first = 20, after, unreadOnly } = args;

    const filter: any = { recipientId: user._id };
    if (unreadOnly) filter.read = false;

    const query = Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(first);

    if (after) {
      query.skip(parseInt(after));
    }

    const notifications = await query;
    const totalCount = await Notification.countDocuments(filter);

    return {
      edges: notifications.map((notification, index) => ({
        cursor: (after ? parseInt(after) + index : index).toString(),
        node: notification,
      })),
      pageInfo: {
        hasNextPage: notifications.length === first,
        hasPreviousPage: !!after && parseInt(after) > 0,
      },
      totalCount,
    };
  },

  unreadNotificationsCount: async (_: any, __: any, context: GraphQLContext) => {
    const user = requireAuth(context);
    return await Notification.countDocuments({ recipientId: user._id, read: false });
  },

  // Analytics
  dashboardAnalytics: async (_: any, __: any, context: GraphQLContext) => {
    requireRole(context, [UserRole.ADMIN]);
    return await AnalyticsService.getDashboardAnalytics();
  },

  channelAnalytics: async (_: any, { channelId }: any, context: GraphQLContext) => {
    requireAuth(context);
    return await AnalyticsService.getChannelStats(channelId);
  },

  userAnalytics: async (_: any, { userId }: any, context: GraphQLContext) => {
    const currentUser = requireAuth(context);

    // Admin peut voir n'importe qui, sinon uniquement soi-même
    if (currentUser.role !== UserRole.ADMIN && currentUser._id.toString() !== userId) {
      throw new Error('Forbidden');
    }

    return await AnalyticsService.getUserStats(userId);
  },

  // Activity Logs
  activityLogs: async (_: any, args: any, context: GraphQLContext) => {
    requireRole(context, [UserRole.ADMIN]);

    const { first = 50, after, userId, resourceType } = args;
    const filter: any = {};

    if (userId) filter.userId = userId;
    if (resourceType) filter.resourceType = resourceType;

    const query = ActivityLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(first);

    if (after) {
      query.skip(parseInt(after));
    }

    const logs = await query;

    return logs;
  },
};
