import type { PublicUser } from '../users/users.types';
import type { UserRole } from '../../db/entities/user.entity';

/** Identity attached to the request after a successful JWT verification. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
}

export interface LoginResult {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: PublicUser;
}
