import mongoose, { Schema, Document } from 'mongoose';

export enum ShortStatus {
  ROLLED = 'ROLLED',           // Short généré aléatoirement
  RETAINED = 'RETAINED',       // Short retenu par l'admin
  REJECTED = 'REJECTED',       // Short rejeté (peut réapparaître)
  ASSIGNED = 'ASSIGNED',       // Assigné à un vidéaste
  IN_PROGRESS = 'IN_PROGRESS', // Vidéaste travaille dessus
  COMPLETED = 'COMPLETED',     // Vidéaste a terminé
  VALIDATED = 'VALIDATED',     // Admin a validé
  PUBLISHED = 'PUBLISHED',     // Publié sur YouTube
}

export interface IShort extends Document {
  videoId: string;                      // ID de la vidéo YouTube
  videoUrl: string;                     // Lien de la vidéo
  sourceChannel: mongoose.Types.ObjectId; // Référence à SourceChannel
  status: ShortStatus;
  rolledAt: Date;
  retainedAt?: Date;
  rejectedAt?: Date;
  assignedTo?: mongoose.Types.ObjectId;   // Référence à User (vidéaste)
  assignedBy?: mongoose.Types.ObjectId;   // Référence à User (admin)
  assignedAt?: Date;
  deadline?: Date;
  targetChannel?: mongoose.Types.ObjectId; // Référence à AdminChannel
  completedAt?: Date;
  validatedAt?: Date;
  publishedAt?: Date;
  title?: string;
  description?: string;
  tags: string[];
  notes?: string;
  adminFeedback?: string;
  // Google Drive fields
  driveFileId?: string;                 // ID du fichier sur Google Drive
  driveFileUrl?: string;                // Lien direct vers le fichier Drive
  driveFolderId?: string;               // ID du dossier contenant le fichier
  uploadedAt?: Date;                    // Date d'upload sur Drive
  fileName?: string;                    // Nom du fichier uploadé
  fileSize?: number;                    // Taille du fichier en bytes
  mimeType?: string;                    // Type MIME du fichier
  createdAt: Date;
  updatedAt: Date;
}

const ShortSchema = new Schema<IShort>(
  {
    videoId: {
      type: String,
      required: true,
      trim: true,
    },
    videoUrl: {
      type: String,
      required: true,
      trim: true,
    },
    sourceChannel: {
      type: Schema.Types.ObjectId,
      ref: 'SourceChannel',
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(ShortStatus),
      default: ShortStatus.ROLLED,
    },
    rolledAt: {
      type: Date,
      required: true,
    },
    retainedAt: {
      type: Date,
    },
    rejectedAt: {
      type: Date,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    assignedAt: {
      type: Date,
    },
    deadline: {
      type: Date,
    },
    targetChannel: {
      type: Schema.Types.ObjectId,
      ref: 'AdminChannel',
    },
    completedAt: {
      type: Date,
    },
    validatedAt: {
      type: Date,
    },
    publishedAt: {
      type: Date,
    },
    title: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    notes: {
      type: String,
      trim: true,
    },
    adminFeedback: {
      type: String,
      trim: true,
    },
    // Google Drive fields
    driveFileId: {
      type: String,
      trim: true,
    },
    driveFileUrl: {
      type: String,
      trim: true,
    },
    driveFolderId: {
      type: String,
      trim: true,
    },
    uploadedAt: {
      type: Date,
    },
    fileName: {
      type: String,
      trim: true,
    },
    fileSize: {
      type: Number,
    },
    mimeType: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
ShortSchema.index({ videoId: 1 });
ShortSchema.index({ sourceChannel: 1 });
ShortSchema.index({ status: 1 });
ShortSchema.index({ assignedTo: 1 });
ShortSchema.index({ targetChannel: 1 });
ShortSchema.index({ rolledAt: -1 });
ShortSchema.index({ deadline: 1 });

// Index composé pour empêcher les shorts retenus de réapparaître dans les rolls
ShortSchema.index({ sourceChannel: 1, status: 1 });

// Virtual pour vérifier si le short est en retard
ShortSchema.virtual('isLate').get(function () {
  if (!this.deadline) {
    return false;
  }
  // Statuts où le travail n'est pas encore terminé
  const incompletedStatuses = [ShortStatus.ASSIGNED, ShortStatus.IN_PROGRESS];
  if (!incompletedStatuses.includes(this.status)) {
    return false;
  }
  return new Date() > this.deadline;
});

export const Short = mongoose.model<IShort>('Short', ShortSchema);
