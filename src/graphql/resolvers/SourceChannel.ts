// Resolvers pour SourceChannel
import { GraphQLContext } from '../../context';
import { SourceChannel, ISourceChannel, ContentType } from '../../models/SourceChannel';
import { Short } from '../../models/Short';
import { YouTubeService } from '../../services/youtube.service';
import { GraphQLError } from 'graphql';
import { requireAuth, requireAdmin } from '../../middlewares/auth';

export const SourceChannelResolvers = {
  // Type resolvers
  SourceChannel: {
    // Résoudre les shorts rollés depuis cette chaîne
    shortsRolled: async (parent: ISourceChannel) => {
      return await Short.find({ sourceChannel: parent._id })
        .populate('assignedTo')
        .populate('assignedBy')
        .populate('targetChannel')
        .sort({ rolledAt: -1 });
    },

    // Calculer le nombre total de vidéos via l'API YouTube (non stocké en DB)
    totalVideos: async (parent: ISourceChannel) => {
      try {
        const channelData = await YouTubeService.getChannelById(parent.channelId);
        return channelData.totalVideos || 0;
      } catch (error) {
        // En cas d'erreur API, retourner null
        return null;
      }
    },
  },

  Query: {
    // Récupérer toutes les chaînes sources, optionnellement filtrées par type de contenu
    sourceChannels: async (_: unknown, { contentType }: { contentType?: string }, context: GraphQLContext) => {
      requireAuth(context);

      const filter: Record<string, unknown> = {};
      if (contentType) {
        filter.contentType = contentType;
      }

      return await SourceChannel.find(filter).sort({ createdAt: -1 });
    },

    // Récupérer une chaîne source par ID
    sourceChannel: async (_: unknown, { id }: { id: string }, context: GraphQLContext) => {
      requireAuth(context);

      const channel = await SourceChannel.findById(id);
      if (!channel) {
        throw new GraphQLError('Source channel not found');
      }

      return channel;
    },
  },

  Mutation: {
    // Créer une nouvelle chaîne source
    createSourceChannel: async (_: unknown, { input }: { input: { youtubeUrl: string; contentType: string } }, context: GraphQLContext) => {
      requireAdmin(context);

      try {
        // Extraire les données de la chaîne depuis l'URL
        const channelData = await YouTubeService.extractChannelDataFromUrl(input.youtubeUrl);

        // Vérifier si la chaîne existe déjà
        const existingChannel = await SourceChannel.findOne({ channelId: channelData.channelId });
        if (existingChannel) {
          throw new GraphQLError('This source channel already exists');
        }

        // Créer la chaîne source
        const sourceChannel = new SourceChannel({
          channelId: channelData.channelId,
          channelName: channelData.username,
          profileImageUrl: channelData.profileImageUrl,
          contentType: input.contentType,
        });

        await sourceChannel.save();

        return sourceChannel;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to create source channel';
        throw new GraphQLError(errorMessage || 'Failed to create source channel');
      }
    },

    // Mettre à jour une chaîne source
    updateSourceChannel: async (_: unknown, { id, input }: { id: string; input: { contentType?: string; profileImageUrl?: string } }, context: GraphQLContext) => {
      requireAdmin(context);

      const channel = await SourceChannel.findById(id);
      if (!channel) {
        throw new GraphQLError('Source channel not found');
      }

      // Mettre à jour les champs fournis
      if (input.contentType !== undefined) {
        channel.contentType = input.contentType as ContentType;
      }
      if (input.profileImageUrl !== undefined) {
        channel.profileImageUrl = input.profileImageUrl;
      }

      await channel.save();

      return channel;
    },

    // Supprimer une chaîne source
    deleteSourceChannel: async (_: unknown, { id }: { id: string }, context: GraphQLContext) => {
      requireAdmin(context);

      const channel = await SourceChannel.findById(id);
      if (!channel) {
        throw new GraphQLError('Source channel not found');
      }

      // Vérifier s'il y a des shorts associés
      const shortsCount = await Short.countDocuments({ sourceChannel: id });
      if (shortsCount > 0) {
        throw new GraphQLError(
          `Cannot delete source channel: ${shortsCount} shorts are associated with it`
        );
      }

      await SourceChannel.findByIdAndDelete(id);

      return true;
    },
  },
};
