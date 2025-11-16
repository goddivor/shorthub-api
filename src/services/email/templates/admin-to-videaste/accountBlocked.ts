import { baseTemplate } from '../base';
import { IUser } from '../../../../models/User';

interface AccountStatusData {
  user: IUser;
  admin: IUser;
  reason?: string;
}

export function accountBlockedTemplate(data: AccountStatusData): string {
  const { user, admin, reason } = data;

  const content = `
    <h2>🚫 Compte suspendu</h2>

    <p>Bonjour <strong>${user.username}</strong>,</p>

    <div class="danger-box">
      <p style="margin: 0; font-size: 18px; font-weight: 600;">
        Votre compte ShortHub a été temporairement suspendu
      </p>
    </div>

    <p>
      Votre compte a été suspendu par <strong>${admin.username}</strong>.
    </p>

    ${reason ? `
    <div class="warning-box">
      <p style="margin: 0 0 8px; font-weight: 600;">📋 Raison de la suspension :</p>
      <p style="margin: 0;">${reason}</p>
    </div>
    ` : ''}

    <div class="info-box">
      <p style="margin: 0;">
        <strong>Que signifie cette suspension ?</strong><br>
        • Vous ne pouvez plus accéder à votre compte<br>
        • Vos shorts en cours sont mis en pause<br>
        • Vous ne recevrez plus de nouveaux shorts assignés<br>
        • Cette suspension peut être temporaire ou permanente selon la situation
      </p>
    </div>

    <p style="margin-top: 30px;">
      Si vous pensez qu'il s'agit d'une erreur ou si vous souhaitez discuter de cette décision,
      veuillez contacter directement l'administrateur : <strong>${admin.email || 'admin@shorthub.com'}</strong>
    </p>

    <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
      Pour toute question concernant cette suspension, merci de répondre à cet email ou de contacter l'équipe ShortHub.
    </p>
  `;

  return baseTemplate({
    title: 'Compte suspendu - ShortHub',
    preheader: 'Votre compte ShortHub a été suspendu',
    content,
  });
}
