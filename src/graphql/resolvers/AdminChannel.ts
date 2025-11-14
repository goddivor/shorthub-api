// Resolvers pour AdminChannel
import { GraphQLContext } from '../../context';
import { AdminChannel, IAdminChannel, ContentType } from '../../models/AdminChannel';
import { Short, ShortStatus } from '../../models/Short';
import { YouTubeService } from '../../services/youtube.service';
import { GraphQLError } from 'graphql';
import { requireAuth, requireAdmin } from '../../middlewares/auth';

export const AdminChannelResolvers = {
  // Type resolvers
  AdminChannel: {
    // Résoudre les shorts assignés à cette chaîne
    shortsAssigned: async (parent: IAdminChannel) => {
      return await Short.find({ targetChannel: parent._id })
        .populate('sourceChannel')
        .populate('assignedTo')
        .populate('assignedBy')
        .sort({ assignedAt: -1 });
    },

    // Calculer le nombre total de vidéos via l'API YouTube (non stocké en DB)
    totalVideos: async (parent: IAdminChannel) => {
      try {
        const channelData = await YouTubeService.getChannelById(parent.channelId);
        return channelData.totalVideos || 0;
      } catch (error) {
        return null;
      }
    },

    // Calculer le nombre d'abonnés via l'API YouTube (non stocké en DB)
    subscriberCount: async (parent: IAdminChannel) => {
      try {
        const channelData = await YouTubeService.getChannelById(parent.channelId);
        return channelData.subscriberCount || 0;
      } catch (error) {
        return null;
      }
    },

    // Calculer les statistiques de la chaîne
    stats: async (parent: IAdminChannel) => {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [
        totalShortsPublished,
        totalShortsInProgress,
        totalShortsCompleted,
        videosLast7Days,
        videosLast30Days,
      ] = await Promise.all([
        Short.countDocuments({
          targetChannel: parent._id,
          status: ShortStatus.PUBLISHED,
        }),
        Short.countDocuments({
          targetChannel: parent._id,
          status: { $in: [ShortStatus.ASSIGNED, ShortStatus.IN_PROGRESS] },
        }),
        Short.countDocuments({
          targetChannel: parent._id,
          status: { $in: [ShortStatus.COMPLETED, ShortStatus.VALIDATED] },
        }),
        Short.find({
          targetChannel: parent._id,
          status: ShortStatus.PUBLISHED,
          publishedAt: { $gte: sevenDaysAgo },
        }),
        Short.find({
          targetChannel: parent._id,
          status: ShortStatus.PUBLISHED,
          publishedAt: { $gte: thirtyDaysAgo },
        }),
      ]);

      // Grouper par jour pour les graphiques
      const groupByDay = (shorts: Array<{ publishedAt?: Date }>) => {
        const grouped: Record<string, number> = {};
        shorts.forEach((short) => {
          if (short.publishedAt) {
            const date = short.publishedAt.toISOString().split('T')[0];
            grouped[date] = (grouped[date] || 0) + 1;
          }
        });
        return Object.entries(grouped).map(([date, count]) => ({ date, count }));
      };

      return {
        totalShortsPublished,
        totalShortsInProgress,
        totalShortsCompleted,
        videosPublishedLast7Days: groupByDay(videosLast7Days),
        videosPublishedLast30Days: groupByDay(videosLast30Days),
      };
    },
  },

  Query: {
    // Récupérer toutes les chaînes admin
    adminChannels: async (_: unknown, __: unknown, context: GraphQLContext) => {
      requireAuth(context);
      return await AdminChannel.find().sort({ createdAt: -1 });
    },

    // Récupérer une chaîne admin par ID
    adminChannel: async (_: unknown, { id }: { id: string }, context: GraphQLContext) => {
      requireAuth(context);

      const channel = await AdminChannel.findById(id);
      if (!channel) {
        throw new GraphQLError('Admin channel not found');
      }

      return channel;
    },

    // Récupérer les statistiques d'une chaîne admin
    adminChannelStats: async (_: unknown, { channelId }: { channelId: string }, context: GraphQLContext) => {
      requireAuth(context);

      const channel = await AdminChannel.findById(channelId);
      if (!channel) {
        throw new GraphQLError('Admin channel not found');
      }

      // Les stats sont calculées par le resolver de type AdminChannel
      return AdminChannelResolvers.AdminChannel.stats(channel);
    },
  },

  Mutation: {
    // Créer une nouvelle chaîne admin
    createAdminChannel: async (_: unknown, { input }: { input: { youtubeUrl: string; contentType: ContentType } }, context: GraphQLContext) => {
      requireAdmin(context);

      try {
        // Extraire les données de la chaîne depuis l'URL
        const channelData = await YouTubeService.extractChannelDataFromUrl(input.youtubeUrl);

        // Vérifier si la chaîne existe déjà
        const existingChannel = await AdminChannel.findOne({ channelId: channelData.channelId });
        if (existingChannel) {
          throw new GraphQLError('This admin channel already exists');
        }

        if (!channelData.profileImageUrl) {
          throw new GraphQLError('Could not retrieve channel profile image');
        }

        // Créer la chaîne admin
        const adminChannel = new AdminChannel({
          channelId: channelData.channelId,
          channelName: channelData.username,
          profileImageUrl: channelData.profileImageUrl,
          contentType: input.contentType,
        });

        await adminChannel.save();

        return adminChannel;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to create admin channel';
        throw new GraphQLError(errorMessage);
      }
    },

    // Mettre à jour une chaîne admin
    updateAdminChannel: async (_: unknown, { id, input }: { id: string; input: { contentType?: ContentType; profileImageUrl?: string } }, context: GraphQLContext) => {
      requireAdmin(context);

      const channel = await AdminChannel.findById(id);
      if (!channel) {
        throw new GraphQLError('Admin channel not found');
      }

      // Mettre à jour les champs fournis
      if (input.contentType !== undefined) {
        channel.contentType = input.contentType;
      }
      if (input.profileImageUrl !== undefined) {
        channel.profileImageUrl = input.profileImageUrl;
      }

      await channel.save();

      return channel;
    },

    // Supprimer une chaîne admin
    deleteAdminChannel: async (_: unknown, { id }: { id: string }, context: GraphQLContext) => {
      requireAdmin(context);

      const channel = await AdminChannel.findById(id);
      if (!channel) {
        throw new GraphQLError('Admin channel not found');
      }

      // Vérifier s'il y a des shorts associés
      const shortsCount = await Short.countDocuments({ targetChannel: id });
      if (shortsCount > 0) {
        throw new GraphQLError(
          `Cannot delete admin channel: ${shortsCount} shorts are assigned to it`
        );
      }

      await AdminChannel.findByIdAndDelete(id);

      return true;
    },
  },
};
