import mongoose, { Schema, Document } from 'mongoose';

export interface IVideoComment extends Document {
  videoId: mongoose.Types.ObjectId;
  authorId: mongoose.Types.ObjectId;
  comment: string;
  createdAt: Date;
  updatedAt: Date;
}

const VideoCommentSchema = new Schema<IVideoComment>(
  {
    videoId: {
      type: Schema.Types.ObjectId,
      ref: 'Video',
      required: true,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    comment: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
VideoCommentSchema.index({ videoId: 1, createdAt: -1 });

export const VideoComment = mongoose.model<IVideoComment>('VideoComment', VideoCommentSchema);
