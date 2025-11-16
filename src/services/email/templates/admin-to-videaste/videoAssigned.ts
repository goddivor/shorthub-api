import { baseTemplate } from '../base';
import { formatDate } from '../../emailHelpers';
import { IUser } from '../../../../models/User';
import { IVideo } from '../../../../models/Video';

interface VideoAssignedData {
  videaste: IUser;
  video: IVideo;
  assignedBy: IUser;
  channelName: string;
}

export function videoAssignedTemplate(data: VideoAssignedData): string {
  const { videaste, video, assignedBy, channelName } = data;

  const deadlineText = video.scheduledDate
    ? formatDate(video.scheduledDate)
    : 'Non définie';

  const content = `
    <h2>🎬 Nouveau short assigné</h2>

    <p>Bonjour <strong>${videaste.username}</strong>,</p>

    <p>Un nouveau short vous a été assigné par <strong>${assignedBy.username}</strong>.</p>

    <div class="info-box">
      <p style="margin: 0;"><strong>📌 Détails du short :</strong></p>
    </div>

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
        <span class="video-details-value">${deadlineText}</span>
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

    ${video.notes ? `
    <div class="info-box">
      <p style="margin: 0 0 8px; font-weight: 600;">📝 Notes de l'admin :</p>
      <p style="margin: 0;">${video.notes}</p>
    </div>
    ` : ''}

    <div style="text-align: center;">
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/videaste/shorts" class="button">
        Voir mes shorts
      </a>
    </div>

    <p>Bon montage ! 🎥</p>

    <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
      Si vous avez des questions, n'hésitez pas à contacter l'administrateur.
    </p>
  `;

  return baseTemplate({
    title: 'Nouveau short assigné - ShortHub',
    preheader: `Nouveau short : ${video.title}`,
    content,
  });
}
