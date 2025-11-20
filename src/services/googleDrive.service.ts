import { google } from 'googleapis';
import { GoogleDriveSettings, IGoogleDriveSettings } from '../models/GoogleDriveSettings';
import { Readable } from 'stream';

const CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_DRIVE_REDIRECT_URI;

export class GoogleDriveService {
  private oauth2Client;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
  }

  /**
   * Génère l'URL d'autorisation OAuth pour connecter Google Drive
   */
  getAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive',
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent', // Force la demande de refresh token
    });
  }

  /**
   * Échange le code d'autorisation contre des tokens d'accès
   */
  async exchangeCodeForTokens(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiryDate: number;
    scope: string;
  }> {
    const { tokens } = await this.oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error('Failed to get tokens from Google');
    }

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expiry_date || Date.now() + 3600 * 1000,
      scope: tokens.scope || '',
    };
  }

  /**
   * Sauvegarde ou met à jour les credentials Google Drive
   */
  async saveCredentials(
    accessToken: string,
    refreshToken: string,
    expiryDate: number,
    scope: string
  ): Promise<IGoogleDriveSettings> {
    const tokenExpiresAt = new Date(expiryDate);
    const scopes = scope.split(' ');

    // Vérifier s'il existe déjà des settings
    let settings = await GoogleDriveSettings.findOne();

    if (settings) {
      // Mettre à jour les credentials existants
      settings.setEncryptedTokens(accessToken, refreshToken);
      settings.tokenExpiresAt = tokenExpiresAt;
      settings.scope = scopes;
      settings.isConnected = true;
      settings.lastSync = new Date();
    } else {
      // Créer de nouveaux settings
      settings = new GoogleDriveSettings({
        tokenExpiresAt,
        scope: scopes,
        isConnected: true,
        lastSync: new Date(),
      });
      settings.setEncryptedTokens(accessToken, refreshToken);
    }

    await settings.save();

    // Créer le dossier racine s'il n'existe pas
    if (!settings.rootFolderId) {
      const folderId = await this.createRootFolder(accessToken);
      settings.rootFolderId = folderId;
      await settings.save();
    }

    return settings;
  }

  /**
   * Récupère les credentials stockés
   */
  async getStoredCredentials(): Promise<IGoogleDriveSettings | null> {
    return await GoogleDriveSettings.findOne();
  }

  /**
   * Rafraîchit l'access token si expiré
   */
  async refreshAccessTokenIfNeeded(
    settings: IGoogleDriveSettings
  ): Promise<string> {
    if (!settings.isTokenExpired()) {
      return settings.getDecryptedAccessToken();
    }

    // Token expiré, on le rafraîchit
    this.oauth2Client.setCredentials({
      refresh_token: settings.getDecryptedRefreshToken(),
    });

    const { credentials } = await this.oauth2Client.refreshAccessToken();

    if (!credentials.access_token) {
      throw new Error('Failed to refresh access token');
    }

    // Mettre à jour les credentials
    settings.setEncryptedTokens(
      credentials.access_token,
      settings.getDecryptedRefreshToken()
    );
    settings.tokenExpiresAt = new Date(
      credentials.expiry_date || Date.now() + 3600 * 1000
    );
    await settings.save();

    return credentials.access_token;
  }

  /**
   * Crée le dossier racine "ShortHub" sur Google Drive
   */
  private async createRootFolder(accessToken: string): Promise<string> {
    this.oauth2Client.setCredentials({ access_token: accessToken });
    const drive = google.drive({ version: 'v3', auth: this.oauth2Client });

    const fileMetadata = {
      name: 'ShortHub',
      mimeType: 'application/vnd.google-apps.folder',
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id',
    });

    if (!response.data.id) {
      throw new Error('Failed to create root folder');
    }

    return response.data.id;
  }

  /**
   * Crée un sous-dossier pour un vidéaste dans le dossier racine
   */
  async createVideasteFolder(
    videasteUsername: string,
    accessToken: string,
    rootFolderId: string
  ): Promise<string> {
    this.oauth2Client.setCredentials({ access_token: accessToken });
    const drive = google.drive({ version: 'v3', auth: this.oauth2Client });

    // Vérifier si le dossier existe déjà
    const searchResponse = await drive.files.list({
      q: `name='${videasteUsername}' and '${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });

    if (searchResponse.data.files && searchResponse.data.files.length > 0) {
      return searchResponse.data.files[0].id!;
    }

    // Créer le dossier
    const fileMetadata = {
      name: videasteUsername,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [rootFolderId],
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id',
    });

    if (!response.data.id) {
      throw new Error('Failed to create videaste folder');
    }

    return response.data.id;
  }

  /**
   * Crée un sous-dossier pour un short spécifique
   */
  async createShortFolder(
    shortId: string,
    videasteFolderId: string,
    accessToken: string
  ): Promise<string> {
    this.oauth2Client.setCredentials({ access_token: accessToken });
    const drive = google.drive({ version: 'v3', auth: this.oauth2Client });

    const fileMetadata = {
      name: `Short-${shortId}`,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [videasteFolderId],
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id',
    });

    if (!response.data.id) {
      throw new Error('Failed to create short folder');
    }

    return response.data.id;
  }

  /**
   * Upload un fichier vers Google Drive
   */
  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    folderId: string,
    accessToken: string
  ): Promise<{
    fileId: string;
    fileUrl: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  }> {
    this.oauth2Client.setCredentials({ access_token: accessToken });
    const drive = google.drive({ version: 'v3', auth: this.oauth2Client });

    const fileMetadata = {
      name: fileName,
      parents: [folderId],
    };

    const media = {
      mimeType,
      body: Readable.from(fileBuffer),
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, name, size, mimeType, webViewLink',
    });

    if (!response.data.id) {
      throw new Error('Failed to upload file to Google Drive');
    }

    // Rendre le fichier accessible à l'admin (pas public)
    await drive.permissions.create({
      fileId: response.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone', // Ou 'user' avec l'email de l'admin pour plus de sécurité
      },
    });

    return {
      fileId: response.data.id,
      fileUrl: response.data.webViewLink || '',
      fileName: response.data.name || fileName,
      fileSize: parseInt(response.data.size || '0'),
      mimeType: response.data.mimeType || mimeType,
    };
  }

  /**
   * Déconnecte Google Drive (révoque les tokens)
   */
  async disconnectDrive(): Promise<void> {
    const settings = await GoogleDriveSettings.findOne();
    if (settings) {
      this.oauth2Client.setCredentials({
        access_token: settings.getDecryptedAccessToken(),
      });
      await this.oauth2Client.revokeCredentials();
      await GoogleDriveSettings.deleteMany({});
    }
  }

  /**
   * Vérifie si Google Drive est connecté
   */
  async isConnected(): Promise<boolean> {
    const settings = await GoogleDriveSettings.findOne();
    return settings ? settings.isConnected : false;
  }

  /**
   * Récupère les informations de connexion
   */
  async getConnectionInfo(): Promise<{
    isConnected: boolean;
    rootFolderId?: string;
    rootFolderName?: string;
    lastSync?: Date;
  } | null> {
    const settings = await GoogleDriveSettings.findOne();
    if (!settings) return null;

    return {
      isConnected: settings.isConnected,
      rootFolderId: settings.rootFolderId,
      rootFolderName: settings.rootFolderName,
      lastSync: settings.lastSync,
    };
  }
}

export const googleDriveService = new GoogleDriveService();
