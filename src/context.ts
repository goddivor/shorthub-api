import { IUser } from './models/User';
import DataLoader from 'dataloader';
import { PubSub } from 'graphql-subscriptions';

export const pubsub = new PubSub();

export interface GraphQLContext {
  user: IUser | null;
  dataloaders: {
    userLoader: DataLoader<string, IUser | null>;
    channelLoader: DataLoader<string, any>;
    videoLoader: DataLoader<string, any>;
  };
  pubsub: PubSub;
}
