import mongoose, { Schema, Document } from 'mongoose';
import crypto from 'crypto';

// Algorithme de chiffrement pour les tokens sensibles
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-cbc';

// Helper functions pour chiffrer/déchiffrer
function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text: string): string {
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift()!, 'hex');
  const encryptedText = Buffer.from(parts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY.slice(0, 32)), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

export interface IGoogleDriveSettings extends Document {
  // Un seul document par système (singleton)
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
  scope: string[];
  rootFolderId?: string;
  rootFolderName: string;
  isConnected: boolean;
  lastSync?: Date;
  createdAt: Date;
  updatedAt: Date;

  // Méthodes helpers
  getDecryptedAccessToken(): string;
  getDecryptedRefreshToken(): string;
  setEncryptedTokens(accessToken: string, refreshToken: string): void;
  isTokenExpired(): boolean;
}

const GoogleDriveSettingsSchema = new Schema<IGoogleDriveSettings>(
  {
    accessToken: {
      type: String,
      required: true,
    },
    refreshToken: {
      type: String,
      required: true,
    },
    tokenExpiresAt: {
      type: Date,
      required: true,
    },
    scope: {
      type: [String],
      default: [],
    },
    rootFolderId: {
      type: String,
    },
    rootFolderName: {
      type: String,
      default: 'ShortHub',
    },
    isConnected: {
      type: Boolean,
      default: false,
    },
    lastSync: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Méthode pour obtenir l'access token déchiffré
GoogleDriveSettingsSchema.methods.getDecryptedAccessToken = function (): string {
  return decrypt(this.accessToken);
};

// Méthode pour obtenir le refresh token déchiffré
GoogleDriveSettingsSchema.methods.getDecryptedRefreshToken = function (): string {
  return decrypt(this.refreshToken);
};

// Méthode pour définir les tokens chiffrés
GoogleDriveSettingsSchema.methods.setEncryptedTokens = function (
  accessToken: string,
  refreshToken: string
): void {
  this.accessToken = encrypt(accessToken);
  this.refreshToken = encrypt(refreshToken);
};

// Méthode pour vérifier si le token est expiré
GoogleDriveSettingsSchema.methods.isTokenExpired = function (): boolean {
  return new Date() >= this.tokenExpiresAt;
};

// Index pour s'assurer qu'il n'y a qu'un seul document de settings
GoogleDriveSettingsSchema.index({ _id: 1 }, { unique: true });

export const GoogleDriveSettings = mongoose.model<IGoogleDriveSettings>(
  'GoogleDriveSettings',
  GoogleDriveSettingsSchema
);
