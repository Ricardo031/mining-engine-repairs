import type { UserRole } from '../../db/entities/user.entity';

/** Safe representation of a user: never includes the password hash. */
export interface PublicUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
