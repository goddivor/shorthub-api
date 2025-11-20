import { GraphQLError } from 'graphql';
import { Request, Response, NextFunction } from 'express';
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

// Express middleware pour authentifier les requêtes REST API
export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: string;
  };
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.headers.authorization;

    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const user = await getUser(token);

    if (!user) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    // Ajouter l'utilisateur à la requête
    (req as AuthRequest).user = {
      id: user.id,
      username: user.username,
      role: user.role,
    };

    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
};
