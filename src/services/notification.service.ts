import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { Notification, NotificationType, INotification } from '../models/Notification';
import { IUser } from '../models/User';
import { IVideo } from '../models/Video';
import { pubsub } from '../context';
import { WhatsAppService } from './whatsapp.service';

// Nodemailer transporter
const emailTransporter = nodemailer.createTransport({
  host: env.EMAIL_HOST,
  port: env.EMAIL_PORT,
  secure: env.EMAIL_SECURE,
  auth: {
    user: env.EMAIL_USER,
    pass: env.EMAIL_PASSWORD,
  },
});

export class NotificationService {
  /**
   * Crée une notification et l'envoie via les canaux appropriés
   */
  static async createAndSend(params: {
    recipientId: string;
    recipient: IUser;
    type: NotificationType;
    message: string;
    videoId?: string;
    video?: IVideo;
  }): Promise<INotification> {
    const { recipientId, recipient, type, message, videoId } = params;

    // Créer la notification dans la base
    const notification = await Notification.create({
      recipientId,
      type,
      videoId,
      message,
      sentViaEmail: false,
      sentViaWhatsApp: false,
      sentViaPlatform: true,
      platformSentAt: new Date(),
      read: false,
    });

    // Envoyer par email si activé
    if (recipient.emailNotifications && recipient.email) {
      try {
        await this.sendEmail(recipient.email, type, message, params.video);
        notification.sentViaEmail = true;
        notification.emailSentAt = new Date();
      } catch (error) {
        logger.error('Failed to send email notification:', error);
      }
    }

    // Envoyer par WhatsApp si activé
    if (recipient.whatsappNotifications && recipient.phone && recipient.whatsappLinked) {
      try {
        const success = await WhatsAppService.sendTextMessage(recipient.phone, message);
        if (success) {
          notification.sentViaWhatsApp = true;
          notification.whatsappSentAt = new Date();
        }
      } catch (error) {
        logger.error('Failed to send WhatsApp notification:', error);
      }
    }

    await notification.save();

    // Publier en temps réel via subscription
    pubsub.publish('NOTIFICATION_RECEIVED', {
      notificationReceived: notification,
      userId: recipientId,
    });

    return notification;
  }

  /**
   * Envoie un email
   */
  private static async sendEmail(
    to: string,
    type: NotificationType,
    message: string,
    video?: IVideo
  ): Promise<void> {
    if (!env.EMAIL_USER || !env.EMAIL_PASSWORD) {
      logger.warn('Email not configured, skipping email notification');
      return;
    }

    const subject = this.getEmailSubject(type);
    const html = this.getEmailHtml(type, message, video);

    try {
      await emailTransporter.sendMail({
        from: env.EMAIL_FROM,
        to,
        subject,
        html,
      });

      logger.info(`Email sent to ${to}`);
    } catch (error) {
      logger.error('Email sending error:', error);
      throw error;
    }
  }

  /**
   * Génère le sujet de l'email selon le type
   */
  private static getEmailSubject(type: NotificationType): string {
    const subjects: Record<NotificationType, string> = {
      VIDEO_ASSIGNED: '🎬 Nouvelle vidéo assignée - ShortHub',
      DEADLINE_REMINDER: '⏰ Rappel: Vidéo à réaliser bientôt',
      VIDEO_COMPLETED: '✅ Vidéo complétée',
      VIDEO_VALIDATED: '✅ Vidéo validée',
      VIDEO_REJECTED: '❌ Vidéo rejetée',
      ACCOUNT_BLOCKED: '🚫 Compte bloqué',
      ACCOUNT_UNBLOCKED: '✅ Compte débloqué',
      SHORT_COMPLETED: '✅ Short complété',
    };

    return subjects[type] || 'Notification ShortHub';
  }

  /**
   * Génère le HTML de l'email
   */
  private static getEmailHtml(_type: NotificationType, message: string, video?: IVideo): string {
    const baseStyles = `
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
        .message { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .video-info { background: #e0e7ff; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
        .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
      </style>
    `;

    let videoSection = '';
    if (video) {
      videoSection = `
        <div class="video-info">
          <h3>Détails de la vidéo:</h3>
          <p><strong>Titre:</strong> ${video.title || 'Sans titre'}</p>
          <p><strong>URL source:</strong> <a href="${video.sourceVideoUrl}">${video.sourceVideoUrl}</a></p>
          ${video.scheduledDate ? `<p><strong>Date de publication:</strong> ${new Date(video.scheduledDate).toLocaleDateString('fr-FR')}</p>` : ''}
          ${video.notes ? `<p><strong>Notes:</strong> ${video.notes}</p>` : ''}
        </div>
      `;
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        ${baseStyles}
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>ShortHub</h1>
          </div>
          <div class="content">
            <div class="message">
              <p>${message}</p>
            </div>
            ${videoSection}
            <div style="text-align: center;">
              <a href="${env.CORS_ORIGIN}/dashboard" class="button">Voir sur ShortHub</a>
            </div>
          </div>
          <div class="footer">
            <p>ShortHub - Plateforme de gestion de YouTube Shorts</p>
            <p>Ceci est un email automatique, merci de ne pas y répondre.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Notifications spécifiques pour différents événements
   */

  static async notifyVideoAssigned(
    recipient: IUser,
    video: IVideo,
    scheduledDate: Date
  ): Promise<INotification> {
    const message = `Une nouvelle vidéo vous a été assignée pour le ${new Date(scheduledDate).toLocaleDateString('fr-FR')}.`;

    // Envoyer via WhatsApp avec message formaté si activé
    if (recipient.whatsappNotifications && recipient.phone && recipient.whatsappLinked) {
      await WhatsAppService.notifyVideoAssigned(
        recipient.phone,
        video.title || 'Sans titre',
        scheduledDate
      );
    }

    return await this.createAndSend({
      recipientId: (recipient as unknown as { _id: { toString: () => string } })._id.toString(),
      recipient,
      type: NotificationType.VIDEO_ASSIGNED,
      message,
      videoId: (video as unknown as { _id: { toString: () => string } })._id.toString(),
      video,
    });
  }

  static async notifyDeadlineReminder(
    recipient: IUser,
    video: IVideo,
    hoursRemaining: number
  ): Promise<INotification> {
    const message = `⏰ Rappel: Il vous reste ${hoursRemaining}h pour réaliser la vidéo "${video.title || 'Sans titre'}".`;

    // Envoyer via WhatsApp avec message formaté si activé
    if (recipient.whatsappNotifications && recipient.phone && recipient.whatsappLinked) {
      await WhatsAppService.notifyDeadlineReminder(
        recipient.phone,
        video.title || 'Sans titre',
        hoursRemaining
      );
    }

    return await this.createAndSend({
      recipientId: (recipient as unknown as { _id: { toString: () => string } })._id.toString(),
      recipient,
      type: NotificationType.DEADLINE_REMINDER,
      message,
      videoId: (video as unknown as { _id: { toString: () => string } })._id.toString(),
      video,
    });
  }

  static async notifyVideoCompleted(
    recipient: IUser,
    video: IVideo,
    completedBy: IUser
  ): Promise<INotification> {
    const message = `✅ ${completedBy.username} a marqué la vidéo "${video.title || 'Sans titre'}" comme complétée.`;

    // Envoyer via WhatsApp avec message formaté si activé (pour l'admin)
    if (recipient.whatsappNotifications && recipient.phone && recipient.whatsappLinked) {
      await WhatsAppService.notifyVideoCompleted(
        recipient.phone,
        video.title || 'Sans titre',
        completedBy.username
      );
    }

    return await this.createAndSend({
      recipientId: (recipient as unknown as { _id: { toString: () => string } })._id.toString(),
      recipient,
      type: NotificationType.VIDEO_COMPLETED,
      message,
      videoId: (video as unknown as { _id: { toString: () => string } })._id.toString(),
      video,
    });
  }

  static async notifyVideoValidated(
    recipient: IUser,
    video: IVideo,
    feedback?: string
  ): Promise<INotification> {
    let message = `✅ Votre vidéo "${video.title || 'Sans titre'}" a été validée.`;
    if (feedback) {
      message += `\n\nFeedback: ${feedback}`;
    }

    // Envoyer via WhatsApp avec message formaté si activé
    if (recipient.whatsappNotifications && recipient.phone && recipient.whatsappLinked) {
      await WhatsAppService.notifyVideoValidated(
        recipient.phone,
        video.title || 'Sans titre',
        feedback
      );
    }

    return await this.createAndSend({
      recipientId: (recipient as unknown as { _id: { toString: () => string } })._id.toString(),
      recipient,
      type: NotificationType.VIDEO_VALIDATED,
      message,
      videoId: (video as unknown as { _id: { toString: () => string } })._id.toString(),
      video,
    });
  }

  static async notifyVideoRejected(
    recipient: IUser,
    video: IVideo,
    feedback: string
  ): Promise<INotification> {
    const message = `❌ Votre vidéo "${video.title || 'Sans titre'}" a été rejetée.\n\nRaison: ${feedback}`;

    // Envoyer via WhatsApp avec message formaté si activé
    if (recipient.whatsappNotifications && recipient.phone && recipient.whatsappLinked) {
      await WhatsAppService.notifyVideoRejected(
        recipient.phone,
        video.title || 'Sans titre',
        feedback
      );
    }

    return await this.createAndSend({
      recipientId: (recipient as unknown as { _id: { toString: () => string } })._id.toString(),
      recipient,
      type: NotificationType.VIDEO_REJECTED,
      message,
      videoId: (video as unknown as { _id: { toString: () => string } })._id.toString(),
      video,
    });
  }

  static async notifyAccountStatusChanged(
    recipient: IUser,
    status: 'BLOCKED' | 'UNBLOCKED'
  ): Promise<INotification> {
    const type =
      status === 'BLOCKED' ? NotificationType.ACCOUNT_BLOCKED : NotificationType.ACCOUNT_UNBLOCKED;
    const message =
      status === 'BLOCKED'
        ? '🚫 Votre compte a été bloqué. Contactez un administrateur pour plus d\'informations.'
        : '✅ Votre compte a été débloqué. Vous pouvez à nouveau vous connecter.';

    // Envoyer via WhatsApp avec message formaté si activé
    if (recipient.whatsappNotifications && recipient.phone && recipient.whatsappLinked) {
      await WhatsAppService.notifyAccountStatusChanged(recipient.phone, status);
    }

    return await this.createAndSend({
      recipientId: (recipient as unknown as { _id: { toString: () => string } })._id.toString(),
      recipient,
      type,
      message,
    });
  }

  /**
   * Notification pour un short complété
   */
  static async createShortCompletedNotification(
    recipientId: string,
    shortId: string,
    videasteUsername: string
  ): Promise<void> {
    const message = `✅ ${videasteUsername} a uploadé la vidéo pour le short.`;

    await Notification.create({
      recipientId: recipientId,
      type: NotificationType.SHORT_COMPLETED,
      short: shortId,
      message,
      sentViaEmail: false,
      sentViaWhatsApp: false,
      sentViaPlatform: true,
      platformSentAt: new Date(),
      read: false,
    });

    // Publier en temps réel via subscription
    pubsub.publish('NOTIFICATION_RECEIVED', {
      notificationReceived: { recipientId, shortId, message },
      userId: recipientId,
    });
  }
}
