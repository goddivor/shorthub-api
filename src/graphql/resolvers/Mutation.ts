import { GraphQLContext } from '../../context';
import { Types } from 'mongoose';
import { requireAuth, requireRole } from '../../middlewares/auth';
import { User, UserRole, UserStatus } from '../../models/User';
import { Channel } from '../../models/Channel';
import { Video, VideoStatus } from '../../models/Video';
import { Notification, NotificationType } from '../../models/Notification';
import { VideoComment } from '../../models/VideoComment';
import { AuthService } from '../../services/auth.service';
import { YouTubeService } from '../../services/youtube.service';
import { NotificationService } from '../../services/notification.service';
import EmailService from '../../services/email/EmailService';
import ImageKitService from '../../services/imagekit.service';
import { hashPassword } from '../../utils/password';
import { GraphQLError } from 'graphql';


export const Mutation = {
  // Auth
  login: async (_: unknown, { username, password }: { username: string; password: string }) => {
    return await AuthService.login(username, password);
  },

  logout: async () => {
    // Logout logic (if using sessions/redis)
    return true;
  },

  refreshToken: async (_: unknown, { token }: { token: string }) => {
    return await AuthService.refreshToken(token);
  },

  changePassword: async (_: unknown, { oldPassword, newPassword }: { oldPassword: string; newPassword: string }, context: GraphQLContext) => {
    const user = requireAuth(context);
    return await AuthService.changePassword((user as unknown as { _id: { toString: () => string } })._id.toString(), oldPassword, newPassword);
  },

  // Users (Admin only)
  createUser: async (_: unknown, { input }: { input: { username: string; email: string; password: string; role: string; phone?: string } }, context: GraphQLContext) => {
    const admin = requireRole(context, [UserRole.ADMIN]);

    const hashedPassword = await hashPassword(input.password);

    const user = await User.create({
      ...input,
      password: hashedPassword,
      createdBy: new Types.ObjectId((admin as unknown as { _id: string })._id),
    });

    return user;
  },

  updateUser: async (_: unknown, { id, input }: { id: string; input: { email?: string; phone?: string; emailNotifications?: boolean; whatsappNotifications?: boolean } }, context: GraphQLContext) => {
    const currentUser = requireAuth(context);

    // Admin peut modifier n'importe qui, sinon uniquement son propre profil
    if (currentUser.role !== UserRole.ADMIN && (currentUser as unknown as { _id: { toString: () => string } })._id.toString() !== id) {
      throw new GraphQLError('Forbidden', { extensions: { code: 'FORBIDDEN' } });
    }

    const user = await User.findByIdAndUpdate(id, input, { new: true });

    if (!user) {
      throw new GraphQLError('User not found', { extensions: { code: 'NOT_FOUND' } });
    }

    return user;
  },

  updateUserStatus: async (_: unknown, { id, status }: { id: string; status: string }, context: GraphQLContext) => {
    const admin = requireRole(context, [UserRole.ADMIN]);

    const user = await User.findByIdAndUpdate(id, { status }, { new: true });

    if (!user) {
      throw new GraphQLError('User not found', { extensions: { code: 'NOT_FOUND' } });
    }

    // Notify user
    await Notification.create({
      recipientId: (user as unknown as { _id: string })._id,
      type: status === UserStatus.BLOCKED ? 'ACCOUNT_BLOCKED' : 'ACCOUNT_UNBLOCKED',
      message: `Your account has been ${status.toLowerCase()}`,
      sentViaEmail: user.emailNotifications,
      sentViaPlatform: true,
      platformSentAt: new Date(),
    });

    // Send email notification
    if (user.emailNotifications && user.email) {
      if (status === UserStatus.BLOCKED) {
        await EmailService.sendAccountBlockedEmail({
          user,
          admin,
        });
      } else {
        await EmailService.sendAccountUnblockedEmail({
          user,
          admin,
        });
      }
    }

    return user;
  },

  deleteUser: async (_: unknown, { id }: { id: string }, context: GraphQLContext) => {
    requireRole(context, [UserRole.ADMIN]);

    const user = await User.findByIdAndDelete(id);

    if (!user) {
      throw new GraphQLError('User not found', { extensions: { code: 'NOT_FOUND' } });
    }

    return true;
  },

  adminChangeUserPassword: async (_: unknown, { userId, newPassword }: { userId: string; newPassword: string }, context: GraphQLContext) => {
    requireRole(context, [UserRole.ADMIN]);

    const user = await User.findById(userId);

    if (!user) {
      throw new GraphQLError('User not found', { extensions: { code: 'NOT_FOUND' } });
    }

    const hashedPassword = await hashPassword(newPassword);
    user.password = hashedPassword;
    await user.save();

    return true;
  },

  // Channels
  createChannel: async (_: unknown, { input }: { input: { youtubeUrl: string; ownedBy?: string } }, context: GraphQLContext) => {
    requireAuth(context);

    const channel = await Channel.create(input);
    return channel;
  },

  updateChannel: async (_: unknown, { id, input }: { id: string; input: { subscriberCount?: number; profileImageUrl?: string } }, context: GraphQLContext) => {
    requireAuth(context);

    const channel = await Channel.findByIdAndUpdate(id, input, { new: true });

    if (!channel) {
      throw new GraphQLError('Channel not found', { extensions: { code: 'NOT_FOUND' } });
    }

    return channel;
  },

  deleteChannel: async (_: unknown, { id }: { id: string }, context: GraphQLContext) => {
    requireAuth(context);

    const channel = await Channel.findByIdAndDelete(id);

    if (!channel) {
      throw new GraphQLError('Channel not found', { extensions: { code: 'NOT_FOUND' } });
    }

    return true;
  },

  refreshChannelSubscribers: async (_: unknown, { id }: { id: string }, context: GraphQLContext) => {
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new GraphQLError(`Failed to refresh subscribers: ${errorMessage}`);
    }
  },

  // Videos
  rollVideos: async (_: unknown, { input }: { input: { sourceChannelIds: string[]; count?: number } }, context: GraphQLContext) => {
    requireRole(context, [UserRole.ADMIN]);

    const { sourceChannelIds, count } = input;

    if (sourceChannelIds.length === 0) {
      throw new GraphQLError('At least one source channel is required');
    }

    const rolledVideos: unknown[] = [];

    for (const channelId of sourceChannelIds) {
      const channel = await Channel.findById(channelId);

      if (!channel) {
        continue;
      }

      // Récupérer les vidéos déjà rollées de cette chaîne
      const existingVideos = await Video.find({ sourceChannelId: channelId });
      const excludeUrls = existingVideos.map((v) => v.sourceVideoUrl);

      // Roller N vidéos depuis cette chaîne
      const videosToRoll = Math.ceil((count || 5) / sourceChannelIds.length);

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
          // Error rolling video
        }
      }
    }

    return rolledVideos;
  },
  assignVideo: async (_: unknown, { input }: { input: { videoId: string; videasteId: string; scheduledDate: string; publicationChannelId: string; notes?: string } }, context: GraphQLContext) => {
    const admin = requireRole(context, [UserRole.ADMIN]);

    const video = await Video.findByIdAndUpdate(
      input.videoId,
      {
        assignedTo: input.videasteId,
        assignedBy: new Types.ObjectId((admin as unknown as { _id: string })._id),
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
      await NotificationService.notifyVideoAssigned(videaste, video, new Date(input.scheduledDate));

      // Send email if videaste has email notifications enabled
      if (videaste.emailNotifications && videaste.email) {
        const sourceChannel = await Channel.findById(video.sourceChannelId);
        if (sourceChannel) {
          await EmailService.sendVideoAssignedEmail({
            videaste,
            video,
            assignedBy: admin,
            channelName: sourceChannel.username,
          });
        }
      }
    }

    return video;
  },

  reassignVideo: async (_: unknown, { videoId, newVideasteId }: { videoId: string; newVideasteId: string }, context: GraphQLContext) => {
    const admin = requireRole(context, [UserRole.ADMIN]);

    const video = await Video.findByIdAndUpdate(
      videoId,
      {
        assignedTo: newVideasteId,
        assignedBy: new Types.ObjectId((admin as unknown as { _id: string })._id),
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

      // Send email if videaste has email notifications enabled
      if (videaste.emailNotifications && videaste.email) {
        const sourceChannel = await Channel.findById(video.sourceChannelId);
        if (sourceChannel) {
          await EmailService.sendVideoAssignedEmail({
            videaste,
            video,
            assignedBy: admin,
            channelName: sourceChannel.username,
          });
        }
      }
    }

    return video;
  },

  updateVideoStatus: async (_: unknown, { input }: { input: { videoId: string; status: string; adminFeedback?: string } }, context: GraphQLContext) => {
    const currentUser = requireAuth(context);

    const video = await Video.findById(input.videoId);

    if (!video) {
      throw new GraphQLError('Video not found', { extensions: { code: 'NOT_FOUND' } });
    }

    const updateData: Record<string, unknown> = { status: input.status };

    if (input.status === VideoStatus.COMPLETED) {
      updateData.completedAt = new Date();
    } else if (input.status === VideoStatus.VALIDATED) {
      updateData.validatedAt = new Date();
      updateData.adminFeedback = input.adminFeedback;
    } else if (input.status === VideoStatus.REJECTED) {
      updateData.adminFeedback = input.adminFeedback;
    } else if (input.status === VideoStatus.PUBLISHED) {
      updateData.publishedAt = new Date();
    }

    const updatedVideo = await Video.findByIdAndUpdate(input.videoId, updateData, { new: true });

    // Handle notifications and emails based on status
    if (input.status === VideoStatus.COMPLETED && video.assignedBy) {
      // Videaste completed the video - notify admin
      const admin = await User.findById(video.assignedBy);
      const videaste = await User.findById(video.assignedTo);

      await Notification.create({
        recipientId: video.assignedBy,
        type: 'VIDEO_COMPLETED',
        videoId: video._id,
        message: `A video has been marked as completed`,
        sentViaEmail: admin?.emailNotifications || false,
        sentViaPlatform: true,
        platformSentAt: new Date(),
      });

      // Send email to admin
      if (admin && admin.emailNotifications && admin.email && videaste && updatedVideo) {
        const sourceChannel = await Channel.findById(video.sourceChannelId);
        if (sourceChannel) {
          await EmailService.sendVideoCompletedEmail({
            admin,
            video: updatedVideo,
            videaste,
            channelName: sourceChannel.username,
          });
        }
      }
    } else if (input.status === VideoStatus.VALIDATED && video.assignedTo) {
      // Admin validated the video - notify videaste
      const videaste = await User.findById(video.assignedTo);

      await Notification.create({
        recipientId: video.assignedTo,
        type: 'VIDEO_VALIDATED',
        videoId: video._id,
        message: `Your video has been validated`,
        sentViaEmail: videaste?.emailNotifications || false,
        sentViaPlatform: true,
        platformSentAt: new Date(),
      });

      // Send email to videaste
      if (videaste && videaste.emailNotifications && videaste.email && updatedVideo) {
        const sourceChannel = await Channel.findById(video.sourceChannelId);
        if (sourceChannel) {
          await EmailService.sendVideoValidatedEmail({
            videaste,
            video: updatedVideo,
            validatedBy: currentUser,
            channelName: sourceChannel.username,
          });
        }
      }
    } else if (input.status === VideoStatus.REJECTED && video.assignedTo) {
      // Admin rejected the video - notify videaste
      const videaste = await User.findById(video.assignedTo);

      await Notification.create({
        recipientId: video.assignedTo,
        type: 'VIDEO_REJECTED',
        videoId: video._id,
        message: `Your video has been rejected`,
        sentViaEmail: videaste?.emailNotifications || false,
        sentViaPlatform: true,
        platformSentAt: new Date(),
      });

      // Send email to videaste
      if (videaste && videaste.emailNotifications && videaste.email && updatedVideo) {
        const sourceChannel = await Channel.findById(video.sourceChannelId);
        if (sourceChannel) {
          await EmailService.sendVideoRejectedEmail({
            videaste,
            video: updatedVideo,
            rejectedBy: currentUser,
            channelName: sourceChannel.username,
            reason: input.adminFeedback,
          });
        }
      }
    }

    return updatedVideo;
  },

  deleteVideo: async (_: unknown, { id }: { id: string }, context: GraphQLContext) => {
    requireRole(context, [UserRole.ADMIN]);

    const video = await Video.findByIdAndDelete(id);

    if (!video) {
      throw new GraphQLError('Video not found', { extensions: { code: 'NOT_FOUND' } });
    }

    return true;
  },

  // Comments
  createComment: async (_: unknown, { input }: { input: { videoId: string; comment: string } }, context: GraphQLContext) => {
    const user = requireAuth(context);

    const comment = await VideoComment.create({
      videoId: input.videoId,
      authorId: new Types.ObjectId((user as unknown as { _id: string })._id),
      comment: input.comment,
    });

    return comment;
  },

  deleteComment: async (_: unknown, { id }: { id: string }, context: GraphQLContext) => {
    const user = requireAuth(context);

    const comment = await VideoComment.findById(id);

    if (!comment) {
      throw new GraphQLError('Comment not found', { extensions: { code: 'NOT_FOUND' } });
    }

    // Only author or admin can delete
    if (comment.authorId.toString() !== (user as unknown as { _id: { toString: () => string } })._id.toString() && user.role !== UserRole.ADMIN) {
      throw new GraphQLError('Forbidden', { extensions: { code: 'FORBIDDEN' } });
    }

    await VideoComment.findByIdAndDelete(id);

    return true;
  },

  // Notifications
  markNotificationAsRead: async (_: unknown, { id }: { id: string }, context: GraphQLContext) => {
    const user = requireAuth(context);

    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipientId: (user as unknown as { _id: string })._id },
      { read: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      throw new GraphQLError('Notification not found', { extensions: { code: 'NOT_FOUND' } });
    }

    return notification;
  },

  markAllNotificationsAsRead: async (_: unknown, __: unknown, context: GraphQLContext) => {
    const user = requireAuth(context);

    await Notification.updateMany({ recipientId: (user as unknown as { _id: string })._id, read: false }, { read: true, readAt: new Date() });

    return true;
  },

  // Batch operations
  assignMultipleVideos: async (_: unknown, { videoIds, videasteId, scheduledDates }: { videoIds: string[]; videasteId: string; scheduledDates: string[] }, context: GraphQLContext) => {
    const admin = requireRole(context, [UserRole.ADMIN]);

    if (videoIds.length !== scheduledDates.length) {
      throw new GraphQLError('videoIds and scheduledDates must have the same length');
    }

    const videos: unknown[] = [];

    for (let i = 0; i < videoIds.length; i++) {
      const video = await Video.findByIdAndUpdate(
        videoIds[i],
        {
          assignedTo: videasteId,
          assignedBy: new Types.ObjectId((admin as unknown as { _id: string })._id),
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
        recipientId: (videaste as unknown as { _id: { toString: () => string } })._id.toString(),
        recipient: videaste,
        type: NotificationType.VIDEO_ASSIGNED,
        message: `${videos.length} nouvelles vidéos vous ont été assignées`,
      });
    }

    return videos;
  },

  updateMultipleVideosStatus: async (_: unknown, { videoIds, status }: { videoIds: string[]; status: string }, context: GraphQLContext) => {
    requireAuth(context);

    const updateData: Record<string, unknown> = { status };

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
  assignAssistant: async (_: unknown, { videasteId, assistantId }: { videasteId: string; assistantId: string }, context: GraphQLContext) => {
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

    videaste.assignedTo = new Types.ObjectId((assistant as unknown as { _id: string })._id);
    await videaste.save();

    return videaste;
  },

  // User account connections (Self-service)
  connectGoogleAccount: async (_: unknown, { email }: { email: string }, context: GraphQLContext) => {
    const user = requireAuth(context);

    // Vérifier si l'email est déjà utilisé
    const existingUser = await User.findOne({ email, _id: { $ne: (user as unknown as { _id: string })._id } });
    if (existingUser) {
      throw new GraphQLError('This email is already in use by another account');
    }

    user.email = email;
    user.emailNotifications = true;
    await user.save();

    return user;
  },

  disconnectGoogleAccount: async (_: unknown, __: unknown, context: GraphQLContext) => {
    const user = requireAuth(context);

    user.email = undefined;
    user.emailNotifications = false;
    await user.save();

    return user;
  },

  connectWhatsAppAccount: async (_: unknown, { phone }: { phone: string }, context: GraphQLContext) => {
    const user = requireAuth(context);

    // Vérifier si le numéro est déjà utilisé
    const existingUser = await User.findOne({ phone, _id: { $ne: (user as unknown as { _id: string })._id } });
    if (existingUser) {
      throw new GraphQLError('This phone number is already in use by another account');
    }

    user.phone = phone;
    user.whatsappLinked = true;
    user.whatsappNotifications = true;
    await user.save();

    return user;
  },

  disconnectWhatsAppAccount: async (_: unknown, __: unknown, context: GraphQLContext) => {
    const user = requireAuth(context);

    user.phone = undefined;
    user.whatsappLinked = false;
    user.whatsappNotifications = false;
    await user.save();

    return user;
  },

  // Profile image
  uploadProfileImage: async (_: unknown, { base64Image }: { base64Image: string }, context: GraphQLContext) => {
    const user = requireAuth(context);

    if (!ImageKitService.isConfigured()) {
      throw new GraphQLError('Image upload service is not configured');
    }

    try {
      // Upload image to ImageKit
      const fileName = `profile-${(user as unknown as { _id: { toString: () => string } })._id.toString()}-${Date.now()}.jpg`;
      const imageUrl = await ImageKitService.uploadBase64Image(base64Image, fileName, 'profile-images');

      // Update user profile
      user.profileImage = imageUrl;
      await user.save();

      return user;
    } catch (error) {
      throw new GraphQLError('Failed to upload profile image');
    }
  },

  removeProfileImage: async (_: unknown, __: unknown, context: GraphQLContext) => {
    const user = requireAuth(context);

    user.profileImage = undefined;
    await user.save();

    return user;
  },
};
