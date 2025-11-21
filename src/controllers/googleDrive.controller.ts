import { Request, Response } from 'express';
import { googleDriveService } from '../services/googleDrive.service';
import { NotificationService } from '../services/notification.service';
import { Short, ShortStatus, IShort } from '../models/Short';
import { IUser, UserRole } from '../models/User';
import { User } from '../models/User';
import multer from 'multer';
import { AuthRequest } from '../middlewares/auth';
import mongoose from 'mongoose';

// Type pour un Short avec assignedTo populé
interface IShortPopulated extends Omit<IShort, 'assignedTo'> {
  assignedTo?: IUser | mongoose.Types.ObjectId;
}

// Configuration de Multer pour stocker les fichiers en mémoire
const storage = multer.memoryStorage();
export const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // Limite à 500MB
  },
  fileFilter: (_req, file, cb) => {
    // Accepter uniquement les fichiers vidéo
    const allowedMimeTypes = [
      'video/mp4',
      'video/mpeg',
      'video/quicktime',
      'video/x-msvideo',
      'video/x-matroska',
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  },
});

/**
 * Génère l'URL d'autorisation OAuth pour Google Drive
 */
export const getAuthUrl = async (_req: Request, res: Response) => {
  try {
    const authUrl = googleDriveService.getAuthUrl();
    res.json({ authUrl });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate authorization URL' });
  }
};

/**
 * Callback OAuth - Échange le code contre des tokens
 */
export const handleOAuthCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.query;

    if (!code || typeof code !== 'string') {
      res.status(400).json({ error: 'Authorization code is required' });
      return;
    }

    // Échanger le code contre des tokens
    const tokens = await googleDriveService.exchangeCodeForTokens(code);

    // Sauvegarder les credentials
    await googleDriveService.saveCredentials(
      tokens.accessToken,
      tokens.refreshToken,
      tokens.expiryDate,
      tokens.scope
    );

    // Rediriger vers le frontend avec succès
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/admin/settings?drive=connected`);
  } catch (error) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/admin/settings?drive=error`);
  }
};

/**
 * Récupère les informations de connexion Google Drive
 */
export const getConnectionInfo = async (_req: Request, res: Response) => {
  try {
    const info = await googleDriveService.getConnectionInfo();
    res.json(info || { isConnected: false });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get connection information' });
  }
};

/**
 * Déconnecte Google Drive
 */
export const disconnectDrive = async (_req: Request, res: Response) => {
  try {
    await googleDriveService.disconnectDrive();
    res.json({ success: true, message: 'Google Drive disconnected successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to disconnect Google Drive' });
  }
};

/**
 * Upload une vidéo vers Google Drive pour un short spécifique
 */
export const uploadVideo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { shortId } = req.params;
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    // Vérifier que le short existe
    const short = await Short.findById(shortId).populate('assignedTo') as IShortPopulated | null;
    if (!short) {
      res.status(404).json({ error: 'Short not found' });
      return;
    }

    // Vérifier que l'utilisateur est bien celui assigné au short
    const userId = (req as AuthRequest).user?.id;

    // Extraire l'ID depuis assignedTo (peut être un ObjectId ou un User populé)
    let assignedToId: string | undefined;

    if (short.assignedTo) {
      if (short.assignedTo instanceof mongoose.Types.ObjectId) {
        assignedToId = short.assignedTo.toString();
      } else if (typeof short.assignedTo === 'object' && 'id' in short.assignedTo) {
        const user = short.assignedTo as unknown as IUser;
        assignedToId = user.id; // Utilise .id qui est déjà une string (getter Mongoose)
      }
    }

    if (!userId || !assignedToId || assignedToId !== userId) {
      res.status(403).json({ error: 'Unauthorized to upload for this short' });
      return;
    }

    // Récupérer les credentials Google Drive
    const settings = await googleDriveService.getStoredCredentials();
    if (!settings || !settings.isConnected) {
      res.status(400).json({ error: 'Google Drive is not connected' });
      return;
    }

    // Rafraîchir le token si nécessaire
    const accessToken = await googleDriveService.refreshAccessTokenIfNeeded(settings);

    // Si un fichier existe déjà (re-upload pour REJECTED), le supprimer
    if (short.driveFileId) {
      try {
        await googleDriveService.deleteFile(short.driveFileId, accessToken);
      } catch (deleteError) {
        console.error('Failed to delete old file:', deleteError);
        // Continue même si la suppression échoue (le fichier n'existe peut-être plus)
      }
    }

    // Extraire le username du vidéaste
    let videasteUsername: string;
    if (short.assignedTo && typeof short.assignedTo === 'object' && '_id' in short.assignedTo) {
      const user = short.assignedTo as unknown as IUser;
      videasteUsername = user.username;
    } else {
      res.status(500).json({ error: 'Unable to determine videaste username' });
      return;
    }

    // Créer la structure de dossiers: ShortHub/[Vidéaste]/[Short-ID]
    const videasteFolderId = await googleDriveService.createVideasteFolder(
      videasteUsername,
      accessToken,
      settings.rootFolderId!
    );

    const shortFolderId = await googleDriveService.createShortFolder(
      short.id,
      videasteFolderId,
      accessToken
    );

    // Upload le fichier
    const uploadResult = await googleDriveService.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype,
      shortFolderId,
      accessToken
    );

    // Mettre à jour le short avec les informations du fichier
    short.driveFileId = uploadResult.fileId;
    short.driveFileUrl = uploadResult.fileUrl;
    short.driveFolderId = shortFolderId;
    short.uploadedAt = new Date();
    short.fileName = uploadResult.fileName;
    short.fileSize = uploadResult.fileSize;
    short.mimeType = uploadResult.mimeType;
    short.status = ShortStatus.COMPLETED;
    short.completedAt = new Date();

    await short.save();

    // Envoyer une notification à tous les admins
    try {
      const admins = await User.find({ role: UserRole.ADMIN, status: 'ACTIVE' });
      const videasteUser = short.assignedTo as unknown as IUser;

      for (const admin of admins) {
        await NotificationService.createShortCompletedNotification(
          admin.id,
          short.id,
          videasteUser.username
        );
      }
    } catch (notifError) {
      console.error('Failed to send notification:', notifError);
      // Ne pas bloquer la réponse si la notification échoue
    }

    res.json({
      success: true,
      message: 'Video uploaded successfully',
      short: {
        id: short.id,
        driveFileUrl: short.driveFileUrl,
        fileName: short.fileName,
        fileSize: short.fileSize,
        status: short.status,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload video' });
  }
};

/**
 * Télécharge une vidéo depuis Google Drive
 */
export const downloadVideo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { shortId } = req.params;

    // Vérifier que le short existe
    const short = await Short.findById(shortId).populate('assignedTo') as IShortPopulated | null;
    if (!short) {
      res.status(404).json({ error: 'Short not found' });
      return;
    }

    // Vérifier qu'un fichier est bien uploadé
    if (!short.driveFileId) {
      res.status(404).json({ error: 'No file uploaded for this short' });
      return;
    }

    // Vérifier les permissions
    const userId = (req as AuthRequest).user?.id;
    const userRole = (req as AuthRequest).user?.role;

    let assignedToId: string | undefined;
    if (short.assignedTo) {
      if (short.assignedTo instanceof mongoose.Types.ObjectId) {
        assignedToId = short.assignedTo.toString();
      } else if (typeof short.assignedTo === 'object' && 'id' in short.assignedTo) {
        const user = short.assignedTo as unknown as IUser;
        assignedToId = user.id;
      }
    }

    // Seul l'admin ou le vidéaste assigné peut télécharger
    if (userRole !== 'ADMIN' && (!userId || assignedToId !== userId)) {
      res.status(403).json({ error: 'Unauthorized to download this video' });
      return;
    }

    // Récupérer les credentials Google Drive
    const settings = await googleDriveService.getStoredCredentials();
    if (!settings || !settings.isConnected) {
      res.status(400).json({ error: 'Google Drive is not connected' });
      return;
    }

    // Rafraîchir le token si nécessaire
    const accessToken = await googleDriveService.refreshAccessTokenIfNeeded(settings);

    // Télécharger le fichier
    const { data, fileName, mimeType } = await googleDriveService.downloadFile(
      short.driveFileId,
      accessToken
    );

    // Configurer les headers pour le téléchargement
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    // Stream le fichier vers la réponse
    data.pipe(res);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Failed to download video' });
  }
};
