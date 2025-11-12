import { GraphQLContext } from '../../context';
import { requireAuth, requireRole } from '../../middlewares/auth';
import { User, UserRole, UserStatus } from '../../models/User';
import { Channel } from '../../models/Channel';
import { Video, VideoStatus } from '../../models/Video';
import { Notification } from '../../models/Notification';
import { VideoComment } from '../../models/VideoComment';
import { AuthService } from '../../services/auth.service';
import { YouTubeService } from '../../services/youtube.service';
import { NotificationService } from '../../services/notification.service';
import { hashPassword } from '../../utils/password';
import { GraphQLError } from 'graphql';
import mongoose from 'mongoose';

export const Mutation = {
  // Auth
  login: async (_: any, { username, password }: any) => {
    return await AuthService.login(username, password);
  },

  logout: async () => {
    // Logout logic (if using sessions/redis)
    return true;
  },

  refreshToken: async (_: any, { token }: any) => {
    return await AuthService.refreshToken(token);
  },

  changePassword: async (_: any, { oldPassword, newPassword }: any, context: GraphQLContext) => {
    const user = requireAuth(context);
    return await AuthService.changePassword(user._id.toString(), oldPassword, newPassword);
  },

  // Users (Admin only)
  createUser: async (_: any, { input }: any, context: GraphQLContext) => {
    const admin = requireRole(context, [UserRole.ADMIN]);

    const hashedPassword = await hashPassword(input.password);

    const user = await User.create({
      ...input,
      password: hashedPassword,
      createdBy: admin._id,
    });

    return user;
  },

  updateUser: async (_: any, { id, input }: any, context: GraphQLContext) => {
    const currentUser = requireAuth(context);

    // Admin peut modifier n'importe qui, sinon uniquement son propre profil
    if (currentUser.role !== UserRole.ADMIN && currentUser._id.toString() !== id) {
      throw new GraphQLError('Forbidden', { extensions: { code: 'FORBIDDEN' } });
    }

    const user = await User.findByIdAndUpdate(id, input, { new: true });

    if (!user) {
      throw new GraphQLError('User not found', { extensions: { code: 'NOT_FOUND' } });
    }

    return user;
  },

  updateUserStatus: async (_: any, { id, status }: any, context: GraphQLContext) => {
    requireRole(context, [UserRole.ADMIN]);

    const user = await User.findByIdAndUpdate(id, { status }, { new: true });

    if (!user) {
      throw new GraphQLError('User not found', { extensions: { code: 'NOT_FOUND' } });
    }

    // Notify user
    await Notification.create({
      recipientId: user._id,
      type: status === UserStatus.BLOCKED ? 'ACCOUNT_BLOCKED' : 'ACCOUNT_UNBLOCKED',
      message: `Your account has been ${status.toLowerCase()}`,
      sentViaEmail: user.emailNotifications,
    });

    return user;
  },

  deleteUser: async (_: any, { id }: any, context: GraphQLContext) => {
    requireRole(context, [UserRole.ADMIN]);

    const user = await User.findByIdAndDelete(id);

    if (!user) {
      throw new GraphQLError('User not found', { extensions: { code: 'NOT_FOUND' } });
    }

    return true;
  },

  // Channels
  createChannel: async (_: any, { input }: any, context: GraphQLContext) => {
    requireAuth(context);

    const channel = await Channel.create(input);
    return channel;
  },

  updateChannel: async (_: any, { id, input }: any, context: GraphQLContext) => {
    requireAuth(context);

    const channel = await Channel.findByIdAndUpdate(id, input, { new: true });

    if (!channel) {
      throw new GraphQLError('Channel not found', { extensions: { code: 'NOT_FOUND' } });
    }

    return channel;
  },

  deleteChannel: async (_: any, { id }: any, context: GraphQLContext) => {
    requireAuth(context);

    const channel = await Channel.findByIdAndDelete(id);

    if (!channel) {
      throw new GraphQLError('Channel not found', { extensions: { code: 'NOT_FOUND' } });
    }

    return true;
  },

  refreshChannelSubscribers: async (_: any, { id }: any, context: GraphQLContext) => {
    requireAuth(context);

    const channel = await Channel.findById(id);

    if (!channel) {
      throw new GraphQLError('Channel not found', { extensions: { code: 'NOT_FOUND' } });
    }

    try {
      const newSubscriberCount = await YouTubeService.refreshSubscriberCount(channel.channelId);

      // Ajouter à l'historique
      channel.subscriberHistory.push({
        count: newSubscriberCount,
        date: new Date(),
      });

      channel.subscriberCount = newSubscriberCount;
      await channel.save();

      return channel;
    } catch (error: any) {
      throw new GraphQLError(`Failed to refresh subscribers: ${error.message}`);
    }
  },

  // Videos
  rollVideos: async (_: any, { input }: any, context: GraphQLContext) => {
    requireRole(context, [UserRole.ADMIN]);

    const { sourceChannelIds, count } = input;

    if (sourceChannelIds.length === 0) {
      throw new GraphQLError('At least one source channel is required');
    }

    const rolledVideos: any[] = [];

    for (const channelId of sourceChannelIds) {
      const channel = await Channel.findById(channelId);

      if (!channel) {
        continue;
      }

      // Récupérer les vidéos déjà rollées de cette chaîne
      const existingVideos = await Video.find({ sourceChannelId: channelId });
      const excludeUrls = existingVideos.map((v) => v.sourceVideoUrl);

      // Roller N vidéos depuis cette chaîne
      const videosToRoll = Math.ceil(count / sourceChannelIds.length);

      for (let i = 0; i < videosToRoll; i++) {
        try {
          const shortData = await YouTubeService.rollRandomShort(channel.channelId, excludeUrls);

          if (shortData) {
            const video = await Video.create({
              sourceChannelId: channel._id,
              sourceVideoUrl: shortData.url,
              rolledAt: new Date(),
              status: VideoStatus.ROLLED,
              title: shortData.title,
              tags: shortData.tags,
            });

            rolledVideos.push(video);
            excludeUrls.push(shortData.url);
          }
        } catch (error) {
          // Continuer même si une vidéo échoue
          console.error('Error rolling video:', error);
        }
      }
    }

    return rolledVideos;
  },
  assignVideo: async (_: any, { input }: any, context: GraphQLContext) => {
    const admin = requireRole(context, [UserRole.ADMIN]);

    const video = await Video.findByIdAndUpdate(
      input.videoId,
      {
        assignedTo: input.videasteId,
        assignedBy: admin._id,
        assignedAt: new Date(),
        publicationChannelId: input.publicationChannelId,
        scheduledDate: input.scheduledDate,
        notes: input.notes,
        status: VideoStatus.ASSIGNED,
      },
      { new: true }
    );

    if (!video) {
      throw new GraphQLError('Video not found', { extensions: { code: 'NOT_FOUND' } });
    }

    // Send notification via service
    const videaste = await User.findById(input.videasteId);
    if (videaste) {
      await NotificationService.notifyVideoAssigned(videaste, video, input.scheduledDate);
    }

    return video;
  },

  reassignVideo: async (_: any, { videoId, newVideasteId }: any, context: GraphQLContext) => {
    const admin = requireRole(context, [UserRole.ADMIN]);

    const video = await Video.findByIdAndUpdate(
      videoId,
      {
        assignedTo: newVideasteId,
        assignedBy: admin._id,
        assignedAt: new Date(),
      },
      { new: true }
    );

    if (!video) {
      throw new GraphQLError('Video not found', { extensions: { code: 'NOT_FOUND' } });
    }

    // Notify new videaste
    const videaste = await User.findById(newVideasteId);
    if (videaste && video.scheduledDate) {
      await NotificationService.notifyVideoAssigned(videaste, video, video.scheduledDate);
    }

    return video;
  },

  updateVideoStatus: async (_: any, { input }: any, context: GraphQLContext) => {
    const user = requireAuth(context);

    const video = await Video.findById(input.videoId);

    if (!video) {
      throw new GraphQLError('Video not found', { extensions: { code: 'NOT_FOUND' } });
    }

    const updateData: any = { status: input.status };

    if (input.status === VideoStatus.COMPLETED) {
      updateData.completedAt = new Date();
    } else if (input.status === VideoStatus.VALIDATED) {
      updateData.validatedAt = new Date();
      updateData.adminFeedback = input.adminFeedback;
    } else if (input.status === VideoStatus.PUBLISHED) {
      updateData.publishedAt = new Date();
    }

    const updatedVideo = await Video.findByIdAndUpdate(input.videoId, updateData, { new: true });

    // Create notification
    if (input.status === VideoStatus.COMPLETED && video.assignedBy) {
      await Notification.create({
        recipientId: video.assignedBy,
        type: 'VIDEO_COMPLETED',
        videoId: video._id,
        message: `A video has been marked as completed`,
        sentViaEmail: true,
      });
    }

    return updatedVideo;
  },

  deleteVideo: async (_: any, { id }: any, context: GraphQLContext) => {
    requireRole(context, [UserRole.ADMIN]);

    const video = await Video.findByIdAndDelete(id);

    if (!video) {
      throw new GraphQLError('Video not found', { extensions: { code: 'NOT_FOUND' } });
    }

    return true;
  },

  // Comments
  createComment: async (_: any, { input }: any, context: GraphQLContext) => {
    const user = requireAuth(context);

    const comment = await VideoComment.create({
      videoId: input.videoId,
      authorId: user._id,
      comment: input.comment,
    });

    return comment;
  },

  deleteComment: async (_: any, { id }: any, context: GraphQLContext) => {
    const user = requireAuth(context);

    const comment = await VideoComment.findById(id);

    if (!comment) {
      throw new GraphQLError('Comment not found', { extensions: { code: 'NOT_FOUND' } });
    }

    // Only author or admin can delete
    if (comment.authorId.toString() !== user._id.toString() && user.role !== UserRole.ADMIN) {
      throw new GraphQLError('Forbidden', { extensions: { code: 'FORBIDDEN' } });
    }

    await VideoComment.findByIdAndDelete(id);

    return true;
  },

  // Notifications
  markNotificationAsRead: async (_: any, { id }: any, context: GraphQLContext) => {
    const user = requireAuth(context);

    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipientId: user._id },
      { read: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      throw new GraphQLError('Notification not found', { extensions: { code: 'NOT_FOUND' } });
    }

    return notification;
  },

  markAllNotificationsAsRead: async (_: any, __: any, context: GraphQLContext) => {
    const user = requireAuth(context);

    await Notification.updateMany({ recipientId: user._id, read: false }, { read: true, readAt: new Date() });

    return true;
  },

  // Batch operations
  assignMultipleVideos: async (_: any, { videoIds, videasteId, scheduledDates }: any, context: GraphQLContext) => {
    const admin = requireRole(context, [UserRole.ADMIN]);

    if (videoIds.length !== scheduledDates.length) {
      throw new GraphQLError('videoIds and scheduledDates must have the same length');
    }

    const videos: any[] = [];

    for (let i = 0; i < videoIds.length; i++) {
      const video = await Video.findByIdAndUpdate(
        videoIds[i],
        {
          assignedTo: videasteId,
          assignedBy: admin._id,
          assignedAt: new Date(),
          scheduledDate: scheduledDates[i],
          status: VideoStatus.ASSIGNED,
        },
        { new: true }
      );

      if (video) {
        videos.push(video);
      }
    }

    // Notify videaste once for all videos
    const videaste = await User.findById(videasteId);
    if (videaste && videos.length > 0) {
      await NotificationService.createAndSend({
        recipientId: videaste._id.toString(),
        recipient: videaste,
        type: 'VIDEO_ASSIGNED',
        message: `${videos.length} nouvelles vidéos vous ont été assignées`,
      });
    }

    return videos;
  },

  updateMultipleVideosStatus: async (_: any, { videoIds, status }: any, context: GraphQLContext) => {
    requireAuth(context);

    const updateData: any = { status };

    if (status === VideoStatus.COMPLETED) {
      updateData.completedAt = new Date();
    } else if (status === VideoStatus.VALIDATED) {
      updateData.validatedAt = new Date();
    } else if (status === VideoStatus.PUBLISHED) {
      updateData.publishedAt = new Date();
    }

    await Video.updateMany({ _id: { $in: videoIds } }, updateData);

    const videos = await Video.find({ _id: { $in: videoIds } });

    return videos;
  },

  // Assign assistant to videaste
  assignAssistant: async (_: any, { videasteId, assistantId }: any, context: GraphQLContext) => {
    requireRole(context, [UserRole.ADMIN]);

    const videaste = await User.findById(videasteId);
    const assistant = await User.findById(assistantId);

    if (!videaste || !assistant) {
      throw new GraphQLError('User not found');
    }

    if (videaste.role !== UserRole.VIDEASTE) {
      throw new GraphQLError('User must be a videaste');
    }

    if (assistant.role !== UserRole.ASSISTANT) {
      throw new GraphQLError('User must be an assistant');
    }

    videaste.assignedTo = assistant._id;
    await videaste.save();

    return videaste;
  },
};
