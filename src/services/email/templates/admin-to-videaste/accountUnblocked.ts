import { baseTemplate } from '../base';
import { IUser } from '../../../../models/User';

interface AccountStatusData {
  user: IUser;
  admin: IUser;
  reason?: string;
}

export function accountUnblockedTemplate(data: AccountStatusData): string {
  const { user, admin } = data;

  const content = `
    <h2>✅ Compte réactivé</h2>

    <p>Bonjour <strong>${user.username}</strong>,</p>

    <div class="success-box">
      <p style="margin: 0; font-size: 18px; font-weight: 600;">
        🎉 Bonne nouvelle ! Votre compte a été réactivé
      </p>
    </div>

    <p>
      Votre compte ShortHub a été réactivé par <strong>${admin.username}</strong>.
      Vous pouvez à nouveau accéder à toutes les fonctionnalités de la plateforme.
    </p>

    <div class="info-box">
      <p style="margin: 0;">
        <strong>Ce que cela signifie :</strong><br>
        • Vous pouvez vous reconnecter à votre compte<br>
        • Vous pourrez recevoir de nouveaux shorts à éditer<br>
        • Vos shorts en attente sont à nouveau accessibles<br>
        • Toutes les fonctionnalités sont rétablies
      </p>
    </div>

    <div style="text-align: center;">
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login" class="button">
        Se connecter
      </a>
    </div>

    <p style="margin-top: 30px; text-align: center;">
      Bienvenue de retour ! 🎬
    </p>

    <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
      Si vous avez des questions, n'hésitez pas à contacter l'administrateur.
    </p>
  `;

  return baseTemplate({
    title: 'Compte réactivé - ShortHub',
    preheader: 'Votre compte ShortHub a été réactivé',
    content,
  });
}
