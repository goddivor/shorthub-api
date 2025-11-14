import DataLoader from 'dataloader';
import { User, IUser } from '../models/User';
import { Channel, IChannel } from '../models/Channel';
import { Video, IVideo } from '../models/Video';

// User Loader
export const createUserLoader = () =>
  new DataLoader<string, IUser | null>(async (userIds) => {
    const users = await User.find({ _id: { $in: userIds } });
    const userMap = new Map(users.map((user) => [(user as any)._id.toString(), user]));
    return userIds.map((id) => userMap.get(id) || null);
  });

// Channel Loader
export const createChannelLoader = () =>
  new DataLoader<string, IChannel | null>(async (channelIds) => {
    const channels = await Channel.find({ _id: { $in: channelIds } });
    const channelMap = new Map(channels.map((channel) => [(channel as any)._id.toString(), channel]));
    return channelIds.map((id) => channelMap.get(id) || null);
  });

// Video Loader
export const createVideoLoader = () =>
  new DataLoader<string, IVideo | null>(async (videoIds) => {
    const videos = await Video.find({ _id: { $in: videoIds } });
    const videoMap = new Map(videos.map((video) => [(video as any)._id.toString(), video]));
    return videoIds.map((id) => videoMap.get(id) || null);
  });

export const createDataLoaders = () => ({
  userLoader: createUserLoader(),
  channelLoader: createChannelLoader(),
  videoLoader: createVideoLoader(),
});
