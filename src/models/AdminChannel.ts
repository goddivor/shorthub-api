import mongoose, { Schema, Document } from 'mongoose';

export enum ContentType {
  VA_SANS_EDIT = 'VA_SANS_EDIT',
  VA_AVEC_EDIT = 'VA_AVEC_EDIT',
  VF_SANS_EDIT = 'VF_SANS_EDIT',
  VF_AVEC_EDIT = 'VF_AVEC_EDIT',
}

export interface IAdminChannel extends Document {
  channelId: string;          // @username ou channel ID YouTube
  channelName: string;         // Nom de la chaîne
  profileImageUrl: string;     // URL de l'image de profil
  contentType: ContentType;    // Type de contenu
  createdAt: Date;
  updatedAt: Date;
}

const AdminChannelSchema = new Schema<IAdminChannel>(
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
      required: true,
      trim: true,
    },
    contentType: {
      type: String,
      enum: Object.values(ContentType),
      required: true,
      default: ContentType.VA_SANS_EDIT,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
// channelId index is automatically created by unique: true in schema

export const AdminChannel = mongoose.model<IAdminChannel>('AdminChannel', AdminChannelSchema);
