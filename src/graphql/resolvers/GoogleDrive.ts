import { GraphQLContext } from '../../context';
import { googleDriveService } from '../../services/googleDrive.service';

export const GoogleDriveResolvers = {
  Query: {
    /**
     * Récupère les informations de connexion Google Drive
     */
    googleDriveConnectionInfo: async (_: unknown, __: unknown, context: GraphQLContext) => {
      if (!context.user || context.user.role !== 'ADMIN') {
        throw new Error('Unauthorized - Admin access required');
      }

      const info = await googleDriveService.getConnectionInfo();
      return (
        info || {
          isConnected: false,
          rootFolderId: null,
          rootFolderName: null,
          lastSync: null,
        }
      );
    },
  },

  Mutation: {
    /**
     * Obtient l'URL d'autorisation OAuth pour connecter Google Drive
     */
    getGoogleDriveAuthUrl: async (_: unknown, __: unknown, context: GraphQLContext) => {
      if (!context.user || context.user.role !== 'ADMIN') {
        throw new Error('Unauthorized - Admin access required');
      }

      const authUrl = googleDriveService.getAuthUrl();
      return authUrl;
    },

    /**
     * Déconnecte Google Drive (révoque les tokens)
     */
    disconnectGoogleDrive: async (_: unknown, __: unknown, context: GraphQLContext) => {
      if (!context.user || context.user.role !== 'ADMIN') {
        throw new Error('Unauthorized - Admin access required');
      }

      await googleDriveService.disconnectDrive();
      return true;
    },
  },
};
