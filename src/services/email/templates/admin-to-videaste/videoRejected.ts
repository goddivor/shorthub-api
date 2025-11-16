import { baseTemplate } from '../base';
import { IUser } from '../../../../models/User';
import { IVideo } from '../../../../models/Video';

interface VideoRejectedData {
  videaste: IUser;
  video: IVideo;
  rejectedBy: IUser;
  channelName: string;
  reason?: string;
}

export function videoRejectedTemplate(data: VideoRejectedData): string {
  const { videaste, video, rejectedBy, channelName, reason } = data;

  const content = `
    <h2>❌ Short rejeté - Révision nécessaire</h2>

    <p>Bonjour <strong>${videaste.username}</strong>,</p>

    <div class="danger-box">
      <p style="margin: 0; font-size: 18px; font-weight: 600;">
        Le short suivant nécessite des modifications
      </p>
    </div>

    <p>
      Votre short a été examiné par <strong>${rejectedBy.username}</strong> et nécessite des ajustements avant validation.
    </p>

    <div class="video-details">
      <div class="video-details-row">
        <span class="video-details-label">Titre :</span>
        <span class="video-details-value">${video.title}</span>
      </div>
      <div class="video-details-row">
        <span class="video-details-label">Chaîne source :</span>
        <span class="video-details-value">${channelName}</span>
      </div>
      <div class="video-details-row">
        <span class="video-details-label">Rejeté par :</span>
        <span class="video-details-value">${rejectedBy.username}</span>
      </div>
      <div class="video-details-row">
        <span class="video-details-label">Statut :</span>
        <span class="video-details-value" style="color: #ef4444; font-weight: 600;">Rejeté</span>
      </div>
    </div>

    ${reason || video.adminFeedback ? `
    <div class="warning-box">
      <p style="margin: 0 0 8px; font-weight: 600;">📋 Raisons du rejet :</p>
      <p style="margin: 0;">${reason || video.adminFeedback}</p>
    </div>
    ` : ''}

    <div class="info-box">
      <p style="margin: 0;">
        <strong>Que faire maintenant ?</strong><br>
        • Examinez attentivement les commentaires ci-dessus<br>
        • Apportez les corrections nécessaires<br>
        • Soumettez à nouveau le short pour validation<br>
        • Contactez l'admin si vous avez des questions
      </p>
    </div>

    <div style="text-align: center;">
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/videaste/shorts" class="button">
        Voir le short
      </a>
    </div>

    <p style="margin-top: 30px;">
      Ne vous découragez pas ! Les retours sont là pour vous aider à vous améliorer. 💪
    </p>
  `;

  return baseTemplate({
    title: 'Short rejeté - ShortHub',
    preheader: `Le short "${video.title}" nécessite des modifications`,
    content,
  });
}
