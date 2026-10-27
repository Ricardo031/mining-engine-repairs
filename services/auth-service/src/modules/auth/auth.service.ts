import { AppError } from '../../common/errors';
import { AppDataSource } from '../../config/data-source';
import { User } from '../../db/entities/user.entity';
import { signAccessToken } from '../../utils/jwt';
import { DUMMY_PASSWORD_HASH, verifyPassword } from '../../utils/password';
import { toPublicUser, usersService } from '../users/users.service';
import type { LoginResult } from './auth.types';

export class AuthService {
  async login(email: string, password: string): Promise<LoginResult> {
    const user = await usersService.findByEmailWithPassword(email);

    // Always run a bcrypt comparison, even for unknown emails, so response
    // time does not reveal whether the account exists.
    const passwordHash = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
    const passwordMatches = await verifyPassword(password, passwordHash);

    if (!user || !passwordMatches || !user.isActive) {
      throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const lastLoginAt = new Date();
    await AppDataSource.getRepository(User).update(user.id, { lastLoginAt });
    user.lastLoginAt = lastLoginAt;

    const { token, expiresIn } = signAccessToken(user);

    return {
      accessToken: token,
      tokenType: 'Bearer',
      expiresIn,
      user: toPublicUser(user),
    };
  }
}

export const authService = new AuthService();
