import axios from 'axios';
import { env } from '../config/env';
import { logger } from '../utils/logger';

/**
 * Service pour l'envoi de messages WhatsApp via l'API WhatsApp Business de Meta
 */
export class WhatsAppService {
  private static baseUrl = `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}`;
  private static phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;
  private static accessToken = env.WHATSAPP_ACCESS_TOKEN;

  /**
   * Vérifie si WhatsApp est configuré
   */
  static isConfigured(): boolean {
    return !!(this.accessToken && this.phoneNumberId);
  }

  /**
   * Formate le numéro de téléphone au format international
   * @param phone - Numéro de téléphone (avec ou sans +)
   * @returns Numéro formaté (sans + ni espaces)
   */
  private static formatPhoneNumber(phone: string): string {
    // Supprimer tous les caractères non numériques sauf le +
    let formatted = phone.replace(/[^\d+]/g, '');

    // Supprimer le + du début s'il existe
    if (formatted.startsWith('+')) {
      formatted = formatted.substring(1);
    }

    return formatted;
  }

  /**
   * Envoie un message texte WhatsApp
   *
   * ⚠️ LIMITATION : Les messages texte libres ne fonctionnent que si l'utilisateur
   * a initié une conversation dans les dernières 24h. Sinon, il faut utiliser
   * des templates approuvés (voir sendTemplateMessage).
   *
   * @param to - Numéro de téléphone du destinataire (format international)
   * @param message - Message à envoyer
   */
  static async sendTextMessage(to: string, message: string): Promise<boolean> {
    if (!this.isConfigured()) {
      logger.warn('WhatsApp not configured, skipping message');
      return false;
    }

    try {
      const formattedPhone = this.formatPhoneNumber(to);

      const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;

      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedPhone,
        type: 'text',
        text: {
          preview_url: true,
          body: message,
        },
      };

      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 200) {
        logger.info(`WhatsApp message sent to ${formattedPhone}`, {
          messageId: response.data.messages?.[0]?.id,
        });
        return true;
      }

      logger.error('WhatsApp API returned non-200 status', {
        status: response.status,
        data: response.data,
      });
      return false;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // Erreur 131047 = message en dehors de la fenêtre de 24h
        const errorCode = error.response?.data?.error?.code;
        const errorMessage = error.response?.data?.error?.message;

        if (errorCode === 131047 || errorMessage?.includes('24 hour')) {
          logger.warn(`WhatsApp 24h window expired for ${to}. Consider using templates.`, {
            errorCode,
            errorMessage,
          });
        } else {
          logger.error('WhatsApp sending error:', {
            status: error.response?.status,
            errorCode,
            errorMessage,
            data: error.response?.data,
          });
        }
      } else {
        logger.error('WhatsApp sending error:', error);
      }
      return false;
    }
  }

  /**
   * Envoie un message template WhatsApp
   * @param to - Numéro de téléphone du destinataire
   * @param templateName - Nom du template WhatsApp approuvé
   * @param languageCode - Code de langue (ex: 'fr', 'en')
   * @param components - Paramètres du template
   */
  static async sendTemplateMessage(
    to: string,
    templateName: string,
    languageCode: string = 'fr',
    components?: Array<{
      type: string;
      parameters: Array<{ type: string; text: string }>;
    }>
  ): Promise<boolean> {
    if (!this.isConfigured()) {
      logger.warn('WhatsApp not configured, skipping template message');
      return false;
    }

    try {
      const formattedPhone = this.formatPhoneNumber(to);

      const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;

      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: formattedPhone,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: languageCode,
          },
          components: components || [],
        },
      };

      const response = await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 200) {
        logger.info(`WhatsApp template message sent to ${formattedPhone}`, {
          messageId: response.data.messages?.[0]?.id,
          template: templateName,
        });
        return true;
      }

      logger.error('WhatsApp API returned non-200 status for template', {
        status: response.status,
        data: response.data,
      });
      return false;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error('WhatsApp template sending error:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });
      } else {
        logger.error('WhatsApp template sending error:', error);
      }
      return false;
    }
  }

  /**
   * Notifications spécifiques pour ShortHub
   */

  /**
   * Notifie l'assignation d'un short
   */
  static async notifyVideoAssigned(
    phone: string,
    videoTitle: string,
    deadline: Date
  ): Promise<boolean> {
    const message = `🎬 *ShortHub - Nouveau Short Assigné*

Un nouveau short vous a été assigné :
📌 *${videoTitle}*

⏰ Deadline : ${deadline.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}

Connectez-vous sur ShortHub pour voir les détails.`;

    return await this.sendTextMessage(phone, message);
  }

  /**
   * Rappel de deadline
   */
  static async notifyDeadlineReminder(
    phone: string,
    videoTitle: string,
    hoursRemaining: number
  ): Promise<boolean> {
    const urgency = hoursRemaining <= 24 ? '🚨 URGENT' : '⏰ RAPPEL';

    const message = `${urgency} *ShortHub - Deadline proche*

Il vous reste *${hoursRemaining}h* pour compléter :
📌 *${videoTitle}*

${hoursRemaining <= 24 ? '⚠️ Attention : Deadline très proche !' : ''}

Connectez-vous sur ShortHub pour soumettre votre travail.`;

    return await this.sendTextMessage(phone, message);
  }

  /**
   * Notifie la validation d'un short
   */
  static async notifyVideoValidated(
    phone: string,
    videoTitle: string,
    feedback?: string
  ): Promise<boolean> {
    const message = `✅ *ShortHub - Short Validé*

Félicitations ! Votre short a été validé :
📌 *${videoTitle}*

${feedback ? `💬 Feedback : ${feedback}` : ''}

Excellent travail ! 🎉`;

    return await this.sendTextMessage(phone, message);
  }

  /**
   * Notifie le rejet d'un short
   */
  static async notifyVideoRejected(
    phone: string,
    videoTitle: string,
    feedback: string
  ): Promise<boolean> {
    const message = `❌ *ShortHub - Short Rejeté*

Votre short a été rejeté :
📌 *${videoTitle}*

💬 Raison : ${feedback}

Veuillez le retravailler et le soumettre à nouveau.`;

    return await this.sendTextMessage(phone, message);
  }

  /**
   * Notifie la complétion d'un short (pour l'admin)
   */
  static async notifyVideoCompleted(
    phone: string,
    videoTitle: string,
    videoasteUsername: string
  ): Promise<boolean> {
    const message = `✅ *ShortHub - Short Complété*

Un short a été marqué comme complété :
📌 *${videoTitle}*
👤 Par : ${videoasteUsername}

Connectez-vous pour valider ou rejeter le travail.`;

    return await this.sendTextMessage(phone, message);
  }

  /**
   * Notifie le changement de statut du compte
   */
  static async notifyAccountStatusChanged(
    phone: string,
    status: 'BLOCKED' | 'UNBLOCKED'
  ): Promise<boolean> {
    const message = status === 'BLOCKED'
      ? `🚫 *ShortHub - Compte Bloqué*

Votre compte a été bloqué.
Veuillez contacter un administrateur pour plus d'informations.`
      : `✅ *ShortHub - Compte Débloqué*

Votre compte a été débloqué.
Vous pouvez à nouveau vous connecter et utiliser la plateforme.`;

    return await this.sendTextMessage(phone, message);
  }
}
