import mongoose, { Schema, Document } from 'mongoose';

export enum ChannelLanguage {
  VF = 'VF',
  VA = 'VA',
  VOSTFR = 'VOSTFR',
  VOSTA = 'VOSTA',
  VO = 'VO',
}

export enum ChannelCountry {
  USA = 'USA',
  FRANCE = 'FRANCE',
  OTHER = 'OTHER',
}

export enum EditType {
  SANS_EDIT = 'SANS_EDIT',
  AVEC_EDIT = 'AVEC_EDIT',
}

export enum ChannelPurpose {
  SOURCE = 'SOURCE',
  PUBLICATION = 'PUBLICATION',
}

export enum ChannelType {
  MIX = 'MIX',
  ONLY = 'ONLY',
}

export interface ISubscriberHistoryEntry {
  count: number;
  date: Date;
}

export interface IChannel extends Document {
  youtubeUrl: string;
  channelId: string;
  username: string;
  subscriberCount: number;
  language: ChannelLanguage;
  country?: ChannelCountry;
  editType?: EditType;
  channelPurpose: ChannelPurpose;
  type: ChannelType;
  domain?: string;
  ownedBy?: mongoose.Types.ObjectId;
  subscriberHistory: ISubscriberHistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const SubscriberHistorySchema = new Schema<ISubscriberHistoryEntry>(
  {
    count: {
      type: Number,
      required: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const ChannelSchema = new Schema<IChannel>(
  {
    youtubeUrl: {
      type: String,
      required: true,
      unique: true,
    },
    channelId: {
      type: String,
      required: true,
      unique: true,
    },
    username: {
      type: String,
      required: true,
    },
    subscriberCount: {
      type: Number,
      default: 0,
    },
    language: {
      type: String,
      enum: Object.values(ChannelLanguage),
      required: true,
    },
    country: {
      type: String,
      enum: Object.values(ChannelCountry),
    },
    editType: {
      type: String,
      enum: Object.values(EditType),
    },
    channelPurpose: {
      type: String,
      enum: Object.values(ChannelPurpose),
      required: true,
    },
    type: {
      type: String,
      enum: Object.values(ChannelType),
      required: true,
    },
    domain: {
      type: String,
    },
    ownedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    subscriberHistory: [SubscriberHistorySchema],
  },
  {
    timestamps: true,
  }
);

// Indexes
// youtubeUrl and channelId indexes are automatically created by unique: true in schema
ChannelSchema.index({ channelPurpose: 1, language: 1 });
ChannelSchema.index({ ownedBy: 1 });

export const Channel = mongoose.model<IChannel>('Channel', ChannelSchema);
