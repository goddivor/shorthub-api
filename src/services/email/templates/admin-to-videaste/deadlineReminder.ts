import { baseTemplate } from '../base';
import { formatDate } from '../../emailHelpers';
import { IUser } from '../../../../models/User';
import { IVideo } from '../../../../models/Video';

interface DeadlineReminderData {
  videaste: IUser;
  video: IVideo;
  channelName: string;
  daysRemaining: number;
}

export function deadlineReminderTemplate(data: DeadlineReminderData): string {
  const { videaste, video, channelName, daysRemaining } = data;

  const urgencyClass = daysRemaining <= 1 ? 'danger-box' : 'warning-box';
  const urgencyEmoji = daysRemaining <= 1 ? '🚨' : '⏰';
  const urgencyText = daysRemaining <= 1 ? 'URGENT' : 'RAPPEL';

  const content = `
    <h2>${urgencyEmoji} ${urgencyText} - Deadline proche</h2>

    <p>Bonjour <strong>${videaste.username}</strong>,</p>

    <div class="${urgencyClass}">
      <p style="margin: 0; font-size: 18px; font-weight: 600;">
        ${daysRemaining === 0
          ? '⚠️ La deadline est aujourd\'hui !'
          : daysRemaining === 1
          ? '⚠️ La deadline est demain !'
          : `Il reste ${daysRemaining} jours avant la deadline`
        }
      </p>
    </div>

    <p>
      Ceci est un rappel concernant le short suivant qui doit être complété ${
        daysRemaining === 0 ? 'aujourd\'hui' : daysRemaining === 1 ? 'demain' : `dans ${daysRemaining} jours`
      } :
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
        <span class="video-details-label">Deadline :</span>
        <span class="video-details-value" style="color: #ef4444; font-weight: 600;">
          ${video.scheduledDate ? formatDate(video.scheduledDate) : 'Non définie'}
        </span>
      </div>
      <div class="video-details-row">
        <span class="video-details-label">Statut actuel :</span>
        <span class="video-details-value">${video.status}</span>
      </div>
      ${video.sourceVideoUrl ? `
      <div class="video-details-row">
        <span class="video-details-label">Vidéo source :</span>
        <span class="video-details-value">
          <a href="${video.sourceVideoUrl}" style="color: #3b82f6; text-decoration: none;">
            Voir la vidéo
          </a>
        </span>
      </div>
      ` : ''}
    </div>

    <div style="text-align: center;">
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/videaste/shorts" class="button">
        Voir mes shorts
      </a>
    </div>

    ${daysRemaining <= 1 ? `
    <p style="color: #dc2626; font-weight: 600; margin-top: 20px;">
      ⚠️ Attention : Si vous ne pouvez pas respecter cette deadline, veuillez contacter l'administrateur dès que possible.
    </p>
    ` : `
    <p style="margin-top: 20px;">
      Si vous avez besoin d'une extension de deadline, n'hésitez pas à contacter l'administrateur.
    </p>
    `}
  `;

  return baseTemplate({
    title: 'Rappel deadline - ShortHub',
    preheader: `Deadline ${daysRemaining === 0 ? 'aujourd\'hui' : daysRemaining === 1 ? 'demain' : `dans ${daysRemaining} jours`} : ${video.title}`,
    content,
  });
}
