import mongoose, { Schema, Document } from 'mongoose';

export interface IAdminChannel extends Document {
  channelId: string;          // @username ou channel ID YouTube
  channelName: string;         // Nom de la chaîne
  profileImageUrl: string;     // URL de l'image de profil
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
  },
  {
    timestamps: true,
  }
);

// Indexes
AdminChannelSchema.index({ channelId: 1 });

export const AdminChannel = mongoose.model<IAdminChannel>('AdminChannel', AdminChannelSchema);
