export const SHORTHUB_LOGO_SVG = `
<svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
  <!-- Circular background with YouTube red -->
  <circle cx="32" cy="32" r="30" fill="#FF0000" stroke="#CC0000" stroke-width="2"/>

  <!-- Sync arrows around the circle -->
  <g transform="translate(32,32)">
    <!-- Top sync arrow -->
    <path d="M 0,-20 A 20,20 0 0,1 14.14,-14.14" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <polygon points="14.14,-14.14 18,-18 18,-10 10,-10" fill="white"/>

    <!-- Bottom sync arrow (opposite direction) -->
    <path d="M 0,20 A 20,20 0 0,1 -14.14,14.14" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <polygon points="-14.14,14.14 -18,18 -18,10 -10,10" fill="white"/>
  </g>

  <!-- YouTube play button in center -->
  <g transform="translate(32,32)">
    <circle cx="0" cy="0" r="12" fill="white"/>
    <polygon points="-4,-6 -4,6 8,0" fill="#FF0000"/>
  </g>
</svg>
`;

export const BASE_STYLES = `
  body {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    background-color: #f3f4f6;
  }
  .email-container {
    max-width: 600px;
    margin: 0 auto;
    background-color: #ffffff;
  }
  .email-header {
    background: linear-gradient(135deg, #FF0000 0%, #CC0000 100%);
    padding: 30px 20px;
    text-align: center;
  }
  .email-body {
    padding: 40px 30px;
    color: #1f2937;
    line-height: 1.6;
  }
  .email-footer {
    background-color: #f9fafb;
    padding: 20px 30px;
    text-align: center;
    border-top: 1px solid #e5e7eb;
    color: #6b7280;
    font-size: 14px;
  }
  .button {
    display: inline-block;
    padding: 12px 24px;
    background-color: #3b82f6;
    color: #ffffff !important;
    text-decoration: none;
    border-radius: 8px;
    font-weight: 600;
    margin: 20px 0;
  }
  .button:hover {
    background-color: #2563eb;
  }
  .info-box {
    background-color: #eff6ff;
    border-left: 4px solid #3b82f6;
    padding: 16px;
    margin: 20px 0;
    border-radius: 4px;
  }
  .warning-box {
    background-color: #fef3c7;
    border-left: 4px solid #f59e0b;
    padding: 16px;
    margin: 20px 0;
    border-radius: 4px;
  }
  .success-box {
    background-color: #d1fae5;
    border-left: 4px solid #10b981;
    padding: 16px;
    margin: 20px 0;
    border-radius: 4px;
  }
  .danger-box {
    background-color: #fee2e2;
    border-left: 4px solid #ef4444;
    padding: 16px;
    margin: 20px 0;
    border-radius: 4px;
  }
  .video-details {
    background-color: #f9fafb;
    border-radius: 8px;
    padding: 20px;
    margin: 20px 0;
  }
  .video-details-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 0;
    border-bottom: 1px solid #e5e7eb;
  }
  .video-details-row:last-child {
    border-bottom: none;
  }
  .video-details-label {
    font-weight: 600;
    color: #4b5563;
  }
  .video-details-value {
    color: #1f2937;
  }
  h1 {
    color: #ffffff;
    margin: 20px 0 10px;
    font-size: 28px;
  }
  h2 {
    color: #1f2937;
    margin: 0 0 20px;
    font-size: 24px;
  }
  p {
    margin: 16px 0;
  }
`;

interface BaseTemplateOptions {
  title: string;
  preheader?: string;
  content: string;
}

export function baseTemplate(options: BaseTemplateOptions): string {
  const { title, preheader, content } = options;

  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  <style>
    ${BASE_STYLES}
  </style>
</head>
<body>
  ${preheader ? `<div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${preheader}</div>` : ''}

  <div class="email-container">
    <!-- Header -->
    <div class="email-header">
      ${SHORTHUB_LOGO_SVG}
      <h1>ShortHub</h1>
    </div>

    <!-- Body -->
    <div class="email-body">
      ${content}
    </div>

    <!-- Footer -->
    <div class="email-footer">
      <p style="margin: 10px 0;">
        <strong>ShortHub</strong> - Plateforme de gestion de YouTube Shorts
      </p>
      <p style="margin: 10px 0; font-size: 12px;">
        Cet email a été envoyé automatiquement. Merci de ne pas répondre à ce message.
      </p>
      <p style="margin: 10px 0; font-size: 12px;">
        © ${new Date().getFullYear()} ShortHub. Tous droits réservés.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}
