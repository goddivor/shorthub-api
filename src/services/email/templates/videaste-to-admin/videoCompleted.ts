import { baseTemplate } from '../base';
import { formatDate } from '../../emailHelpers';
import { IUser } from '../../../../models/User';
import { IVideo } from '../../../../models/Video';

interface VideoCompletedData {
  admin: IUser;
  video: IVideo;
  videaste: IUser;
  channelName: string;
}

export function videoCompletedTemplate(data: VideoCompletedData): string {
  const { admin, video, videaste, channelName } = data;

  const deadlineText = video.scheduledDate
    ? formatDate(video.scheduledDate)
    : 'Non définie';

  const completedOnTime = video.scheduledDate
    ? new Date() <= new Date(video.scheduledDate)
    : true;

  const content = `
    <h2>✅ Short complété - Validation requise</h2>

    <p>Bonjour <strong>${admin.username}</strong>,</p>

    <div class="success-box">
      <p style="margin: 0; font-size: 18px; font-weight: 600;">
        ${completedOnTime ? '🎉' : '⚠️'} Un short a été complété et attend votre validation
      </p>
    </div>

    <p>
      <strong>${videaste.username}</strong> a complété le short suivant et l'a soumis pour validation :
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
        <span class="video-details-label">Édité par :</span>
        <span class="video-details-value">${videaste.username}</span>
      </div>
      <div class="video-details-row">
        <span class="video-details-label">Deadline :</span>
        <span class="video-details-value" style="color: ${completedOnTime ? '#10b981' : '#ef4444'}; font-weight: 600;">
          ${deadlineText} ${completedOnTime ? '(Dans les temps ✓)' : '(En retard ⚠️)'}
        </span>
      </div>
      <div class="video-details-row">
        <span class="video-details-label">Date de complétion :</span>
        <span class="video-details-value">${video.completedAt ? formatDate(video.completedAt) : 'Maintenant'}</span>
      </div>
      ${video.sourceVideoUrl ? `
      <div class="video-details-row">
        <span class="video-details-label">Vidéo source :</span>
        <span class="video-details-value">
          <a href="${video.sourceVideoUrl}" style="color: #3b82f6; text-decoration: none;">
            Voir la vidéo originale
          </a>
        </span>
      </div>
      ` : ''}
    </div>

    ${video.notes ? `
    <div class="info-box">
      <p style="margin: 0 0 8px; font-weight: 600;">📝 Notes du vidéaste :</p>
      <p style="margin: 0;">${video.notes}</p>
    </div>
    ` : ''}

    <div class="info-box">
      <p style="margin: 0;">
        <strong>Action requise :</strong><br>
        Veuillez examiner le short et procéder à la validation ou au rejet avec vos commentaires.
      </p>
    </div>

    <div style="text-align: center;">
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/admin/shorts-tracking" class="button">
        Valider / Rejeter le short
      </a>
    </div>

    ${!completedOnTime ? `
    <p style="color: #dc2626; font-weight: 600; margin-top: 20px;">
      ⚠️ Note : Ce short a été complété après la deadline prévue.
    </p>
    ` : ''}
  `;

  return baseTemplate({
    title: 'Short complété - Validation requise',
    preheader: `${videaste.username} a complété "${video.title}"`,
    content,
  });
}
