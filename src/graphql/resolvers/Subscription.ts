import { GraphQLContext } from '../../context';
import { withFilter } from 'graphql-subscriptions';

export const Subscription = {
  // Notification reçue en temps réel
  notificationReceived: {
    subscribe: withFilter(
      (_: any, __: any, context: GraphQLContext) => {
        return context.pubsub.asyncIterator(['NOTIFICATION_RECEIVED']);
      },
      (payload: any, variables: any) => {
        // Ne publier que pour l'utilisateur concerné
        return payload.userId === variables.userId;
      }
    ),
  },

  // Changement de statut d'une vidéo
  videoStatusChanged: {
    subscribe: withFilter(
      (_: any, __: any, context: GraphQLContext) => {
        return context.pubsub.asyncIterator(['VIDEO_STATUS_CHANGED']);
      },
      (payload: any, variables: any) => {
        // Si videoId est fourni, filtrer par videoId
        if (variables.videoId) {
          return payload.video._id.toString() === variables.videoId;
        }
        return true;
      }
    ),
  },

  // Vidéo assignée à un utilisateur
  videoAssigned: {
    subscribe: withFilter(
      (_: any, __: any, context: GraphQLContext) => {
        return context.pubsub.asyncIterator(['VIDEO_ASSIGNED']);
      },
      (payload: any, variables: any) => {
        return payload.userId === variables.userId;
      }
    ),
  },

  // Vidéo complétée (pour l'admin)
  videoCompleted: {
    subscribe: (_: any, __: any, context: GraphQLContext) => {
      return context.pubsub.asyncIterator(['VIDEO_COMPLETED']);
    },
  },

  // Changement de statut d'un utilisateur
  userStatusChanged: {
    subscribe: withFilter(
      (_: any, __: any, context: GraphQLContext) => {
        return context.pubsub.asyncIterator(['USER_STATUS_CHANGED']);
      },
      (payload: any, variables: any) => {
        if (variables.userId) {
          return payload.user._id.toString() === variables.userId;
        }
        return true;
      }
    ),
  },

  // Abonnés de chaîne mis à jour
  channelSubscribersUpdated: {
    subscribe: withFilter(
      (_: any, __: any, context: GraphQLContext) => {
        return context.pubsub.asyncIterator(['CHANNEL_SUBSCRIBERS_UPDATED']);
      },
      (payload: any, variables: any) => {
        if (variables.channelId) {
          return payload.channel._id.toString() === variables.channelId;
        }
        return true;
      }
    ),
  },
};
