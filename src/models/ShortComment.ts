import mongoose, { Schema, Document } from 'mongoose';

export interface IShortComment extends Document {
  short: mongoose.Types.ObjectId;  // Référence au Short
  author: mongoose.Types.ObjectId; // Référence au User
  comment: string;
  createdAt: Date;
}

const ShortCommentSchema = new Schema<IShortComment>(
  {
    short: {
      type: Schema.Types.ObjectId,
      ref: 'Short',
      required: true,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    comment: {
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
ShortCommentSchema.index({ short: 1, createdAt: -1 });
ShortCommentSchema.index({ author: 1 });

export const ShortComment = mongoose.model<IShortComment>('ShortComment', ShortCommentSchema);
