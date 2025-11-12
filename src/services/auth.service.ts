import { User, IUser, UserRole } from '../models/User';
import { hashPassword, comparePassword } from '../utils/password';
import { generateToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { GraphQLError } from 'graphql';

export class AuthService {
  static async login(username: string, password: string) {
    const user = await User.findOne({ username });

    if (!user) {
      throw new GraphQLError('Invalid credentials', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      throw new GraphQLError('Invalid credentials', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }

    if (user.status === 'BLOCKED') {
      throw new GraphQLError('Account is blocked', {
        extensions: { code: 'FORBIDDEN' },
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    const token = generateToken({ userId: user._id.toString(), role: user.role });
    const refreshToken = generateRefreshToken({ userId: user._id.toString(), role: user.role });

    return {
      token,
      refreshToken,
      user,
    };
  }

  static async refreshToken(refreshToken: string) {
    try {
      const payload = verifyRefreshToken(refreshToken);
      const user = await User.findById(payload.userId);

      if (!user || user.status === 'BLOCKED') {
        throw new GraphQLError('Invalid refresh token', {
          extensions: { code: 'UNAUTHENTICATED' },
        });
      }

      const newToken = generateToken({ userId: user._id.toString(), role: user.role });
      const newRefreshToken = generateRefreshToken({ userId: user._id.toString(), role: user.role });

      return {
        token: newToken,
        refreshToken: newRefreshToken,
        user,
      };
    } catch (error) {
      throw new GraphQLError('Invalid refresh token', {
        extensions: { code: 'UNAUTHENTICATED' },
      });
    }
  }

  static async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await User.findById(userId);

    if (!user) {
      throw new GraphQLError('User not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    const isPasswordValid = await comparePassword(oldPassword, user.password);

    if (!isPasswordValid) {
      throw new GraphQLError('Current password is incorrect', {
        extensions: { code: 'BAD_REQUEST' },
      });
    }

    user.password = await hashPassword(newPassword);
    await user.save();

    return true;
  }

  static async createDefaultAdmin() {
    const existingAdmin = await User.findOne({ role: UserRole.ADMIN });

    if (!existingAdmin) {
      const hashedPassword = await hashPassword('admin123');
      await User.create({
        username: 'admin',
        email: 'admin@shorthub.com',
        password: hashedPassword,
        role: UserRole.ADMIN,
        emailNotifications: true,
        whatsappNotifications: false,
        whatsappLinked: false,
      });
      console.log('✅ Default admin user created: admin / admin123');
    }
  }
}
