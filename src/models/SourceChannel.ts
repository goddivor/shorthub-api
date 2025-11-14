import mongoose, { Schema, Document } from 'mongoose';

export enum ContentType {
  VA_SANS_EDIT = 'VA_SANS_EDIT', // Version Anglaise sans édition
  VA_AVEC_EDIT = 'VA_AVEC_EDIT', // Version Anglaise avec édition
  VF_SANS_EDIT = 'VF_SANS_EDIT', // Version Française sans édition
  VF_AVEC_EDIT = 'VF_AVEC_EDIT', // Version Française avec édition
}

export interface ISourceChannel extends Document {
  channelId: string;          // @username ou channel ID YouTube
  channelName: string;         // Nom de la chaîne
  profileImageUrl?: string;    // URL de l'image de profil
  contentType: ContentType;    // Type de contenu
  createdAt: Date;
  updatedAt: Date;
}

const SourceChannelSchema = new Schema<ISourceChannel>(
  {
    channelId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    channelName: {
      type: String,
      required: true,
      trim: true,
    },
    profileImageUrl: {
      type: String,
      trim: true,
    },
    contentType: {
      type: String,
      enum: Object.values(ContentType),
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
SourceChannelSchema.index({ channelId: 1 });
SourceChannelSchema.index({ contentType: 1 });

export const SourceChannel = mongoose.model<ISourceChannel>('SourceChannel', SourceChannelSchema);
