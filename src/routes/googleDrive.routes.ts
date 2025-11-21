import { Router } from 'express';
import {
  getAuthUrl,
  handleOAuthCallback,
  getConnectionInfo,
  disconnectDrive,
  uploadVideo,
  downloadVideo,
  upload,
} from '../controllers/googleDrive.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

/**
 * @route   GET /api/drive/auth-url
 * @desc    Génère l'URL d'autorisation OAuth pour Google Drive
 * @access  Private (Admin uniquement)
 */
router.get('/auth-url', authenticate, getAuthUrl);

/**
 * @route   GET /api/drive/oauth-callback OR /api/auth/google/callback
 * @desc    Callback OAuth après autorisation Google
 * @access  Public (appelé par Google)
 */
router.get('/oauth-callback', handleOAuthCallback);
router.get('/callback', handleOAuthCallback); // Alias pour compatibilité avec Google Cloud Console

/**
 * @route   GET /api/drive/connection-info
 * @desc    Récupère les informations de connexion Google Drive
 * @access  Private (Admin uniquement)
 */
router.get('/connection-info', authenticate, getConnectionInfo);

/**
 * @route   POST /api/drive/disconnect
 * @desc    Déconnecte Google Drive (révoque les tokens)
 * @access  Private (Admin uniquement)
 */
router.post('/disconnect', authenticate, disconnectDrive);

/**
 * @route   POST /api/drive/upload/:shortId
 * @desc    Upload une vidéo vers Google Drive pour un short spécifique
 * @access  Private (Vidéaste uniquement - celui assigné au short)
 */
router.post('/upload/:shortId', authenticate, upload.single('video'), uploadVideo);

/**
 * @route   GET /api/drive/download/:shortId
 * @desc    Télécharge la vidéo d'un short depuis Google Drive
 * @access  Private (Admin ou Vidéaste assigné)
 */
router.get('/download/:shortId', authenticate, downloadVideo);

export default router;
