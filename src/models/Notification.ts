import mongoose, { Schema, Document } from 'mongoose';

export enum NotificationType {
  VIDEO_ASSIGNED = 'VIDEO_ASSIGNED',
  DEADLINE_REMINDER = 'DEADLINE_REMINDER',
  VIDEO_COMPLETED = 'VIDEO_COMPLETED',
  VIDEO_VALIDATED = 'VIDEO_VALIDATED',
  VIDEO_REJECTED = 'VIDEO_REJECTED',
  ACCOUNT_BLOCKED = 'ACCOUNT_BLOCKED',
  ACCOUNT_UNBLOCKED = 'ACCOUNT_UNBLOCKED',
  SHORT_COMPLETED = 'SHORT_COMPLETED',
}

export interface INotification extends Document {
  recipientId: mongoose.Types.ObjectId;
  type: NotificationType;
  videoId?: mongoose.Types.ObjectId;
  short?: mongoose.Types.ObjectId;
  message: string;
  sentViaEmail: boolean;
  sentViaWhatsApp: boolean;
  sentViaPlatform: boolean;
  emailSentAt?: Date;
  whatsappSentAt?: Date;
  platformSentAt?: Date;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    recipientId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
    },
    videoId: {
      type: Schema.Types.ObjectId,
      ref: 'Video',
    },
    short: {
      type: Schema.Types.ObjectId,
      ref: 'Short',
    },
    message: {
      type: String,
      required: true,
    },
    sentViaEmail: {
      type: Boolean,
      default: false,
    },
    sentViaWhatsApp: {
      type: Boolean,
      default: false,
    },
    sentViaPlatform: {
      type: Boolean,
      default: false,
    },
    emailSentAt: {
      type: Date,
    },
    whatsappSentAt: {
      type: Date,
    },
    platformSentAt: {
      type: Date,
    },
    read: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
NotificationSchema.index({ recipientId: 1, read: 1, createdAt: -1 });
NotificationSchema.index({ videoId: 1 });
NotificationSchema.index({ short: 1 });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
