import mongoose, { Schema, Document } from 'mongoose';

export enum VideoStatus {
  ROLLED = 'ROLLED',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  VALIDATED = 'VALIDATED',
  PUBLISHED = 'PUBLISHED',
  REJECTED = 'REJECTED',
}

export interface IVideo extends Document {
  sourceChannelId: mongoose.Types.ObjectId;
  sourceVideoUrl: string;
  rolledAt: Date;
  assignedTo?: mongoose.Types.ObjectId;
  assignedBy?: mongoose.Types.ObjectId;
  assignedAt?: Date;
  publicationChannelId?: mongoose.Types.ObjectId;
  scheduledDate?: Date;
  status: VideoStatus;
  completedAt?: Date;
  validatedAt?: Date;
  publishedAt?: Date;
  title?: string;
  description?: string;
  tags: string[];
  notes?: string;
  adminFeedback?: string;
  createdAt: Date;
  updatedAt: Date;
}

const VideoSchema = new Schema<IVideo>(
  {
    sourceChannelId: {
      type: Schema.Types.ObjectId,
      ref: 'Channel',
      required: true,
    },
    sourceVideoUrl: {
      type: String,
      required: true,
    },
    rolledAt: {
      type: Date,
      default: Date.now,
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
    publicationChannelId: {
      type: Schema.Types.ObjectId,
      ref: 'Channel',
    },
    scheduledDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: Object.values(VideoStatus),
      default: VideoStatus.ROLLED,
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
    },
    description: {
      type: String,
    },
    tags: {
      type: [String],
      default: [],
    },
    notes: {
      type: String,
    },
    adminFeedback: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
VideoSchema.index({ status: 1, scheduledDate: 1 });
VideoSchema.index({ assignedTo: 1, status: 1 });
VideoSchema.index({ sourceChannelId: 1 });
VideoSchema.index({ publicationChannelId: 1 });
VideoSchema.index({ scheduledDate: 1 });

// Virtual pour vérifier si la vidéo est en retard
VideoSchema.virtual('isLate').get(function () {
  if (!this.scheduledDate) {
    return false;
  }
  // Statuts où le travail n'est pas encore terminé
  const incompletedStatuses = [VideoStatus.ASSIGNED, VideoStatus.IN_PROGRESS];
  if (!incompletedStatuses.includes(this.status)) {
    return false;
  }
  return new Date() > this.scheduledDate;
});

export const Video = mongoose.model<IVideo>('Video', VideoSchema);
