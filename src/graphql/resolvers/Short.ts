// Resolvers pour Short
import { GraphQLContext } from '../../context';
import { Short, ShortStatus, IShort } from '../../models/Short';
import { ShortComment } from '../../models/ShortComment';
import { SourceChannel } from '../../models/SourceChannel';
import { AdminChannel } from '../../models/AdminChannel';
import { User } from '../../models/User';
import { Notification, NotificationType } from '../../models/Notification';
import { IVideo } from '../../models/Video';
import { YouTubeService } from '../../services/youtube.service';
import { NotificationService } from '../../services/notification.service';
import EmailService from '../../services/email/EmailService';
import { GraphQLError } from 'graphql';
import { requireAuth, requireAdmin } from '../../middlewares/auth';
import { Types } from 'mongoose';

export const ShortResolvers = {
  // Type resolvers
  Short: {
    sourceChannel: async (parent: IShort) => {
      return await SourceChannel.findById(parent.sourceChannel);
    },

    assignedTo: async (parent: IShort) => {
      return parent.assignedTo ? await User.findById(parent.assignedTo) : null;
    },

    assignedBy: async (parent: IShort) => {
      return parent.assignedBy ? await User.findById(parent.assignedBy) : null;
    },

    targetChannel: async (parent: IShort) => {
      return parent.targetChannel ? await AdminChannel.findById(parent.targetChannel) : null;
    },

    comments: async (parent: IShort) => {
      return await ShortComment.find({ short: parent._id })
        .populate('author')
        .sort({ createdAt: -1 });
    },

    isLate: (parent: IShort) => {
      if (!parent.deadline) {
        return false;
      }
      // Statuts où le travail n'est pas encore terminé
      const incompletedStatuses = [ShortStatus.ASSIGNED, ShortStatus.IN_PROGRESS];
      if (!incompletedStatuses.includes(parent.status)) {
        return false;
      }
      return new Date() > parent.deadline;
    },

    daysUntilDeadline: (parent: IShort) => {
      if (!parent.deadline) return null;
      const now = new Date();
      const deadline = new Date(parent.deadline);
      const diffTime = deadline.getTime() - now.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    },

    timeToComplete: (parent: IShort) => {
      if (!parent.completedAt || !parent.assignedAt) return null;
      const diffTime = parent.completedAt.getTime() - parent.assignedAt.getTime();
      return diffTime / (1000 * 60 * 60); // Hours
    },
  },

  Query: {
    // Récupérer les shorts avec filtres
    shorts: async (_: unknown, { filter }: { filter?: { status?: string; assignedToId?: string; sourceChannelId?: string; targetChannelId?: string; startDate?: string; endDate?: string } }, context: GraphQLContext) => {
      requireAuth(context);

      const query: Record<string, unknown> = {};

      if (filter) {
        if (filter.status) query.status = filter.status;
        if (filter.assignedToId) query.assignedTo = filter.assignedToId;
        if (filter.sourceChannelId) query.sourceChannel = filter.sourceChannelId;
        if (filter.targetChannelId) query.targetChannel = filter.targetChannelId;
        if (filter.startDate || filter.endDate) {
          const rolledAtQuery: Record<string, Date> = {};
          if (filter.startDate) rolledAtQuery.$gte = new Date(filter.startDate);
          if (filter.endDate) rolledAtQuery.$lte = new Date(filter.endDate);
          query.rolledAt = rolledAtQuery;
        }
      }

      return await Short.find(query)
        .populate('sourceChannel')
        .populate('assignedTo')
        .populate('assignedBy')
        .populate('targetChannel')
        .sort({ rolledAt: -1 });
    },

    // Récupérer un short par ID
    short: async (_: unknown, { id }: { id: string }, context: GraphQLContext) => {
      requireAuth(context);

      const short = await Short.findById(id)
        .populate('sourceChannel')
        .populate('assignedTo')
        .populate('assignedBy')
        .populate('targetChannel');

      if (!short) {
        throw new GraphQLError('Short not found');
      }

      return short;
    },

    // Récupérer les statistiques globales des shorts
    shortsStats: async (_: unknown, __: unknown, context: GraphQLContext) => {
      requireAuth(context);

      const [
        totalRolled,
        totalRetained,
        totalRejected,
        totalAssigned,
        totalInProgress,
        totalCompleted,
        totalValidated,
        totalPublished,
      ] = await Promise.all([
        Short.countDocuments({ status: ShortStatus.ROLLED }),
        Short.countDocuments({ status: ShortStatus.RETAINED }),
        Short.countDocuments({ status: ShortStatus.REJECTED }),
        Short.countDocuments({ status: ShortStatus.ASSIGNED }),
        Short.countDocuments({ status: ShortStatus.IN_PROGRESS }),
        Short.countDocuments({ status: ShortStatus.COMPLETED }),
        Short.countDocuments({ status: ShortStatus.VALIDATED }),
        Short.countDocuments({ status: ShortStatus.PUBLISHED }),
      ]);

      return {
        totalRolled,
        totalRetained,
        totalRejected,
        totalAssigned,
        totalInProgress,
        totalCompleted,
        totalValidated,
        totalPublished,
      };
    },
  },

  Mutation: {
    // Roller un short aléatoire depuis une chaîne source
    rollShort: async (_: unknown, { input }: { input: { sourceChannelId: string } }, context: GraphQLContext) => {
      requireAdmin(context);

      const sourceChannel = await SourceChannel.findById(input.sourceChannelId);
      if (!sourceChannel) {
        throw new GraphQLError('Source channel not found');
      }

      try {
        // Récupérer tous les shorts déjà rollés ET retenus de cette chaîne
        // Les shorts rejetés peuvent réapparaître
        const excludedShorts = await Short.find({
          sourceChannel: input.sourceChannelId,
          status: { $in: [ShortStatus.ROLLED, ShortStatus.RETAINED, ShortStatus.ASSIGNED, ShortStatus.IN_PROGRESS, ShortStatus.COMPLETED, ShortStatus.VALIDATED, ShortStatus.PUBLISHED] },
        });

        const excludeUrls = excludedShorts.map((s) => s.videoUrl);

        // Roller un short aléatoire
        const randomShort = await YouTubeService.rollRandomShort(
          sourceChannel.channelId,
          excludeUrls
        );

        if (!randomShort) {
          throw new GraphQLError('No new shorts available from this channel');
        }

        // Extraire le videoId
        const videoId = YouTubeService.extractVideoIdFromUrl(randomShort.url);
        if (!videoId) {
          throw new GraphQLError('Failed to extract video ID from short URL');
        }

        // Créer le short dans la DB
        const short = new Short({
          videoId,
          videoUrl: randomShort.url,
          sourceChannel: input.sourceChannelId,
          status: ShortStatus.ROLLED,
          rolledAt: new Date(),
          tags: randomShort.tags || [],
          title: randomShort.title,
        });

        await short.save();

        return await Short.findById(short._id)
          .populate('sourceChannel')
          .populate('assignedTo')
          .populate('assignedBy')
          .populate('targetChannel');
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to roll short';
        throw new GraphQLError(errorMessage || 'Failed to roll short');
      }
    },

    // Retenir un short (empêche qu'il réapparaisse dans les rolls)
    retainShort: async (_: unknown, { shortId }: { shortId: string }, context: GraphQLContext) => {
      requireAdmin(context);

      const short = await Short.findById(shortId);
      if (!short) {
        throw new GraphQLError('Short not found');
      }

      if (short.status !== ShortStatus.ROLLED) {
        throw new GraphQLError('Can only retain shorts with ROLLED status');
      }

      short.status = ShortStatus.RETAINED;
      short.retainedAt = new Date();

      await short.save();

      return await Short.findById(short._id)
        .populate('sourceChannel')
        .populate('assignedTo')
        .populate('assignedBy')
        .populate('targetChannel');
    },

    // Rejeter un short (peut réapparaître dans les rolls)
    rejectShort: async (_: unknown, { shortId }: { shortId: string }, context: GraphQLContext) => {
      requireAdmin(context);

      const short = await Short.findById(shortId);
      if (!short) {
        throw new GraphQLError('Short not found');
      }

      if (short.status !== ShortStatus.ROLLED) {
        throw new GraphQLError('Can only reject shorts with ROLLED status');
      }

      short.status = ShortStatus.REJECTED;
      short.rejectedAt = new Date();

      await short.save();

      return await Short.findById(short._id)
        .populate('sourceChannel')
        .populate('assignedTo')
        .populate('assignedBy')
        .populate('targetChannel');
    },

    // Assigner un short à un vidéaste
    assignShort: async (_: unknown, { input }: { input: { shortId: string; videasteId: string; targetChannelId: string; deadline: string; notes?: string } }, context: GraphQLContext) => {
      requireAdmin(context);
      const adminUser = context.user!;

      const short = await Short.findById(input.shortId);
      if (!short) {
        throw new GraphQLError('Short not found');
      }

      if (short.status !== ShortStatus.RETAINED) {
        throw new GraphQLError('Can only assign shorts with RETAINED status');
      }

      // Vérifier que le vidéaste existe
      const videaste = await User.findById(input.videasteId);
      if (!videaste || videaste.role !== 'VIDEASTE') {
        throw new GraphQLError('Videaste not found or invalid role');
      }

      // Vérifier que la chaîne cible existe
      const targetChannel = await AdminChannel.findById(input.targetChannelId);
      if (!targetChannel) {
        throw new GraphQLError('Target channel not found');
      }

      short.status = ShortStatus.ASSIGNED;
      short.assignedTo = new Types.ObjectId(input.videasteId);
      short.assignedBy = new Types.ObjectId((adminUser as unknown as { _id: string })._id);
      short.assignedAt = new Date();
      short.deadline = new Date(input.deadline);
      short.targetChannel = new Types.ObjectId(input.targetChannelId);
      short.notes = input.notes;

      await short.save();

      // Envoyer notification au vidéaste
      await NotificationService.notifyVideoAssigned(videaste, short as unknown as IVideo, short.deadline!);

      // Envoyer email si le vidéaste a activé les notifications email
      if (videaste.emailNotifications && videaste.email) {
        const sourceChannel = await SourceChannel.findById(short.sourceChannel);
        if (sourceChannel) {
          await EmailService.sendVideoAssignedEmail({
            videaste,
            video: short as unknown as IVideo,
            assignedBy: adminUser,
            channelName: sourceChannel.channelName,
          });
        }
      }

      return await Short.findById(short._id)
        .populate('sourceChannel')
        .populate('assignedTo')
        .populate('assignedBy')
        .populate('targetChannel');
    },

    // Réassigner un short à un autre vidéaste
    reassignShort: async (_: unknown, { shortId, newVideasteId }: { shortId: string; newVideasteId: string }, context: GraphQLContext) => {
      requireAdmin(context);
      const adminUser = context.user!;

      const short = await Short.findById(shortId);
      if (!short) {
        throw new GraphQLError('Short not found');
      }

      const newVideaste = await User.findById(newVideasteId);
      if (!newVideaste || newVideaste.role !== 'VIDEASTE') {
        throw new GraphQLError('New videaste not found or invalid role');
      }

      short.assignedTo = new Types.ObjectId(newVideasteId);

      await short.save();

      // Envoyer notification au nouveau vidéaste
      if (short.deadline) {
        await NotificationService.notifyVideoAssigned(newVideaste, short as unknown as IVideo, short.deadline);

        // Envoyer email si le vidéaste a activé les notifications email
        if (newVideaste.emailNotifications && newVideaste.email) {
          const sourceChannel = await SourceChannel.findById(short.sourceChannel);
          if (sourceChannel) {
            await EmailService.sendVideoAssignedEmail({
              videaste: newVideaste,
              video: short as unknown as IVideo,
              assignedBy: adminUser,
              channelName: sourceChannel.channelName,
            });
          }
        }
      }

      return await Short.findById(short._id)
        .populate('sourceChannel')
        .populate('assignedTo')
        .populate('assignedBy')
        .populate('targetChannel');
    },

    // Mettre à jour le statut d'un short
    updateShortStatus: async (_: unknown, { input }: { input: { shortId: string; status: string; adminFeedback?: string } }, context: GraphQLContext) => {
      const currentUser = requireAuth(context);

      const short = await Short.findById(input.shortId);
      if (!short) {
        throw new GraphQLError('Short not found');
      }

      short.status = input.status as ShortStatus;

      // Mettre à jour les dates selon le statut
      if (input.status === ShortStatus.COMPLETED) {
        short.completedAt = new Date();
      } else if (input.status === ShortStatus.VALIDATED) {
        short.validatedAt = new Date();
        if (input.adminFeedback !== undefined) {
          short.adminFeedback = input.adminFeedback;
        }
      } else if (input.status === ShortStatus.REJECTED) {
        if (input.adminFeedback !== undefined) {
          short.adminFeedback = input.adminFeedback;
        }
      } else if (input.status === ShortStatus.PUBLISHED) {
        short.publishedAt = new Date();
      }

      await short.save();

      const updatedShort = await Short.findById(short._id)
        .populate('sourceChannel')
        .populate('assignedTo')
        .populate('assignedBy')
        .populate('targetChannel');

      // Gérer les notifications et emails selon le statut
      if (input.status === ShortStatus.COMPLETED && short.assignedBy) {
        // Vidéaste a complété le short - notifier l'admin
        const admin = await User.findById(short.assignedBy);
        const videaste = await User.findById(short.assignedTo);

        await Notification.create({
          recipientId: short.assignedBy,
          type: NotificationType.VIDEO_COMPLETED,
          videoId: short._id,
          message: `Un short a été marqué comme complété`,
          sentViaEmail: admin?.emailNotifications || false,
          sentViaPlatform: true,
          platformSentAt: new Date(),
        });

        // Envoyer email à l'admin
        if (admin && admin.emailNotifications && admin.email && videaste && updatedShort) {
          const sourceChannel = await SourceChannel.findById(short.sourceChannel);
          if (sourceChannel) {
            await EmailService.sendVideoCompletedEmail({
              admin,
              video: updatedShort as unknown as IVideo,
              videaste,
              channelName: sourceChannel.channelName,
            });
          }
        }
      } else if (input.status === ShortStatus.VALIDATED && short.assignedTo) {
        // Admin a validé le short - notifier le vidéaste
        const videaste = await User.findById(short.assignedTo);

        await Notification.create({
          recipientId: short.assignedTo,
          type: NotificationType.VIDEO_VALIDATED,
          videoId: short._id,
          message: `Votre short a été validé`,
          sentViaEmail: videaste?.emailNotifications || false,
          sentViaPlatform: true,
          platformSentAt: new Date(),
        });

        // Envoyer email au vidéaste
        if (videaste && videaste.emailNotifications && videaste.email && updatedShort) {
          const sourceChannel = await SourceChannel.findById(short.sourceChannel);
          if (sourceChannel) {
            await EmailService.sendVideoValidatedEmail({
              videaste,
              video: updatedShort as unknown as IVideo,
              validatedBy: currentUser,
              channelName: sourceChannel.channelName,
            });
          }
        }
      } else if (input.status === ShortStatus.REJECTED && short.assignedTo) {
        // Admin a rejeté le short - notifier le vidéaste
        const videaste = await User.findById(short.assignedTo);

        await Notification.create({
          recipientId: short.assignedTo,
          type: NotificationType.VIDEO_REJECTED,
          videoId: short._id,
          message: `Votre short a été rejeté`,
          sentViaEmail: videaste?.emailNotifications || false,
          sentViaPlatform: true,
          platformSentAt: new Date(),
        });

        // Envoyer email au vidéaste
        if (videaste && videaste.emailNotifications && videaste.email && updatedShort) {
          const sourceChannel = await SourceChannel.findById(short.sourceChannel);
          if (sourceChannel) {
            await EmailService.sendVideoRejectedEmail({
              videaste,
              video: updatedShort as unknown as IVideo,
              rejectedBy: currentUser,
              channelName: sourceChannel.channelName,
              reason: input.adminFeedback,
            });
          }
        }
      }

      return updatedShort;
    },

    // Supprimer un short
    deleteShort: async (_: unknown, { id }: { id: string }, context: GraphQLContext) => {
      requireAdmin(context);

      const short = await Short.findById(id);
      if (!short) {
        throw new GraphQLError('Short not found');
      }

      // Supprimer les commentaires associés
      await ShortComment.deleteMany({ short: id });

      await Short.findByIdAndDelete(id);

      return true;
    },

    // Créer un commentaire sur un short
    createShortComment: async (_: unknown, { input }: { input: { shortId: string; comment: string } }, context: GraphQLContext) => {
      requireAuth(context);
      const user = context.user!;

      const short = await Short.findById(input.shortId);
      if (!short) {
        throw new GraphQLError('Short not found');
      }

      const comment = new ShortComment({
        short: input.shortId,
        author: new Types.ObjectId((user as unknown as { _id: string })._id),
        comment: input.comment,
      });

      await comment.save();

      return await ShortComment.findById(comment._id).populate('author').populate('short');
    },

    // Supprimer un commentaire
    deleteShortComment: async (_: unknown, { id }: { id: string }, context: GraphQLContext) => {
      requireAuth(context);
      const user = context.user!;

      const comment = await ShortComment.findById(id);
      if (!comment) {
        throw new GraphQLError('Comment not found');
      }

      // Seul l'auteur ou un admin peut supprimer
      const userId = (user as unknown as { _id: { toString: () => string } })._id;
      if (comment.author.toString() !== userId.toString() && user.role !== 'ADMIN') {
        throw new GraphQLError('Not authorized to delete this comment');
      }

      await ShortComment.findByIdAndDelete(id);

      return true;
    },
  },
};
