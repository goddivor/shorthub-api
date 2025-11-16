import nodemailer from 'nodemailer';
import { IUser } from '../../models/User';
import { IVideo } from '../../models/Video';
import { logger } from '../../utils/logger';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface VideoAssignedData {
  videaste: IUser;
  video: IVideo;
  assignedBy: IUser;
  channelName: string;
}

interface DeadlineReminderData {
  videaste: IUser;
  video: IVideo;
  channelName: string;
  daysRemaining: number;
}

interface VideoCompletedData {
  admin: IUser;
  video: IVideo;
  videaste: IUser;
  channelName: string;
}

interface VideoValidatedData {
  videaste: IUser;
  video: IVideo;
  validatedBy: IUser;
  channelName: string;
}

interface VideoRejectedData {
  videaste: IUser;
  video: IVideo;
  rejectedBy: IUser;
  channelName: string;
  reason?: string;
}

interface AccountStatusData {
  user: IUser;
  admin: IUser;
  reason?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private fromAddress: string;

  constructor() {
    this.fromAddress = process.env.EMAIL_FROM || 'noreply@shorthub.com';
    this.initializeTransporter();
  }

  private initializeTransporter() {
    try {
      const emailHost = process.env.EMAIL_HOST;
      const emailPort = process.env.EMAIL_PORT;
      const emailUser = process.env.EMAIL_USER;
      const emailPassword = process.env.EMAIL_PASSWORD;

      if (!emailHost || !emailPort || !emailUser || !emailPassword) {
        logger.warn('Email configuration incomplete. Email service disabled.');
        return;
      }

      this.transporter = nodemailer.createTransport({
        host: emailHost,
        port: parseInt(emailPort),
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user: emailUser,
          pass: emailPassword,
        },
      });

      // Verify connection configuration
      this.transporter.verify((error) => {
        if (error) {
          logger.error('Email service verification failed:', error);
          this.transporter = null;
        } else {
          logger.info('✅ Email service ready');
        }
      });
    } catch (error) {
      logger.error('Failed to initialize email service:', error);
      this.transporter = null;
    }
  }

  private async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.transporter) {
      logger.warn('Email service not available. Skipping email send.');
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || this.stripHtml(options.html),
      });

      logger.info(`Email sent successfully to ${options.to}`);
      return true;
    } catch (error) {
      logger.error(`Failed to send email to ${options.to}:`, error);
      return false;
    }
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  // Admin → Vidéaste emails

  async sendVideoAssignedEmail(data: VideoAssignedData): Promise<boolean> {
    if (!data.videaste.email) {
      logger.warn('Videaste has no email address. Skipping email.');
      return false;
    }

    const { videoAssignedTemplate } = await import('./templates/admin-to-videaste/videoAssigned');
    const html = videoAssignedTemplate(data);

    return this.sendEmail({
      to: data.videaste.email,
      subject: `🎬 Nouveau short assigné - ${data.video.title}`,
      html,
    });
  }

  async sendDeadlineReminderEmail(data: DeadlineReminderData): Promise<boolean> {
    if (!data.videaste.email) {
      logger.warn('Videaste has no email address. Skipping email.');
      return false;
    }

    const { deadlineReminderTemplate } = await import('./templates/admin-to-videaste/deadlineReminder');
    const html = deadlineReminderTemplate(data);

    return this.sendEmail({
      to: data.videaste.email,
      subject: `⏰ Rappel deadline - ${data.video.title} (${data.daysRemaining} jour${data.daysRemaining > 1 ? 's' : ''})`,
      html,
    });
  }

  async sendVideoValidatedEmail(data: VideoValidatedData): Promise<boolean> {
    if (!data.videaste.email) {
      logger.warn('Videaste has no email address. Skipping email.');
      return false;
    }

    const { videoValidatedTemplate } = await import('./templates/admin-to-videaste/videoValidated');
    const html = videoValidatedTemplate(data);

    return this.sendEmail({
      to: data.videaste.email,
      subject: `✅ Short validé - ${data.video.title}`,
      html,
    });
  }

  async sendVideoRejectedEmail(data: VideoRejectedData): Promise<boolean> {
    if (!data.videaste.email) {
      logger.warn('Videaste has no email address. Skipping email.');
      return false;
    }

    const { videoRejectedTemplate } = await import('./templates/admin-to-videaste/videoRejected');
    const html = videoRejectedTemplate(data);

    return this.sendEmail({
      to: data.videaste.email,
      subject: `❌ Short rejeté - ${data.video.title}`,
      html,
    });
  }

  async sendAccountBlockedEmail(data: AccountStatusData): Promise<boolean> {
    if (!data.user.email) {
      logger.warn('User has no email address. Skipping email.');
      return false;
    }

    const { accountBlockedTemplate } = await import('./templates/admin-to-videaste/accountBlocked');
    const html = accountBlockedTemplate(data);

    return this.sendEmail({
      to: data.user.email,
      subject: '🚫 Compte suspendu - ShortHub',
      html,
    });
  }

  async sendAccountUnblockedEmail(data: AccountStatusData): Promise<boolean> {
    if (!data.user.email) {
      logger.warn('User has no email address. Skipping email.');
      return false;
    }

    const { accountUnblockedTemplate } = await import('./templates/admin-to-videaste/accountUnblocked');
    const html = accountUnblockedTemplate(data);

    return this.sendEmail({
      to: data.user.email,
      subject: '✅ Compte réactivé - ShortHub',
      html,
    });
  }

  // Vidéaste → Admin emails

  async sendVideoCompletedEmail(data: VideoCompletedData): Promise<boolean> {
    if (!data.admin.email) {
      logger.warn('Admin has no email address. Skipping email.');
      return false;
    }

    const { videoCompletedTemplate } = await import('./templates/videaste-to-admin/videoCompleted');
    const html = videoCompletedTemplate(data);

    return this.sendEmail({
      to: data.admin.email,
      subject: `✅ Short complété - ${data.video.title} par ${data.videaste.username}`,
      html,
    });
  }
}

export default new EmailService();
