import { baseTemplate } from '../base';
import { IUser } from '../../../../models/User';
import { IVideo } from '../../../../models/Video';

interface VideoValidatedData {
  videaste: IUser;
  video: IVideo;
  validatedBy: IUser;
  channelName: string;
}

export function videoValidatedTemplate(data: VideoValidatedData): string {
  const { videaste, video, validatedBy, channelName } = data;

  const content = `
    <h2>✅ Short validé - Félicitations !</h2>

    <p>Bonjour <strong>${videaste.username}</strong>,</p>

    <div class="success-box">
      <p style="margin: 0; font-size: 18px; font-weight: 600;">
        🎉 Votre short a été validé !
      </p>
    </div>

    <p>
      Excellente nouvelle ! Votre travail sur le short suivant a été approuvé par <strong>${validatedBy.username}</strong> :
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
        <span class="video-details-label">Validé par :</span>
        <span class="video-details-value">${validatedBy.username}</span>
      </div>
      <div class="video-details-row">
        <span class="video-details-label">Statut :</span>
        <span class="video-details-value" style="color: #10b981; font-weight: 600;">Validé ✓</span>
      </div>
    </div>

    ${video.adminFeedback ? `
    <div class="success-box">
      <p style="margin: 0 0 8px; font-weight: 600;">💬 Commentaire de l'admin :</p>
      <p style="margin: 0;">${video.adminFeedback}</p>
    </div>
    ` : ''}

    <div style="text-align: center;">
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/videaste/shorts" class="button">
        Voir mes shorts
      </a>
    </div>

    <p style="text-align: center; margin-top: 30px;">
      Excellent travail ! Continuez comme ça ! 🚀
    </p>
  `;

  return baseTemplate({
    title: 'Short validé - ShortHub',
    preheader: `Votre short "${video.title}" a été validé !`,
    content,
  });
}
