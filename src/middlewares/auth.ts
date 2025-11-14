import { GraphQLError } from 'graphql';
import { verifyToken } from '../utils/jwt';
import { User } from '../models/User';
import { GraphQLContext } from '../context';

export const getUser = async (token?: string) => {
  if (!token) {
    return null;
  }

  try {
    // Remove "Bearer " prefix if present
    const cleanToken = token.replace('Bearer ', '');
    const payload = verifyToken(cleanToken);
    const user = await User.findById(payload.userId);

    if (!user || user.status === 'BLOCKED') {
      return null;
    }

    return user;
  } catch (error) {
    return null;
  }
};

export const requireAuth = (context: GraphQLContext) => {
  if (!context.user) {
    throw new GraphQLError('You must be logged in', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  return context.user;
};

export const requireRole = (context: GraphQLContext, allowedRoles: string[]) => {
  const user = requireAuth(context);

  if (!allowedRoles.includes(user.role)) {
    throw new GraphQLError('You do not have permission to perform this action', {
      extensions: { code: 'FORBIDDEN' },
    });
  }

  return user;
};

export const requireAdmin = (context: GraphQLContext) => {
  return requireRole(context, ['ADMIN']);
};
