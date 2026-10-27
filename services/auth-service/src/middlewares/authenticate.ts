import type { RequestHandler } from 'express';
import { AppDataSource } from '../config/data-source';
import { User } from '../db/entities/user.entity';
import { AppError } from '../common/errors';
import { verifyAccessToken } from '../utils/jwt';
import type { AuthenticatedUser } from '../modules/auth/auth.types';

/**
 * Verifies the JWT signature/claims and then re-checks the user in the
 * database. That second check guarantees that deactivated or deleted users
 * cannot keep using a token that has not expired yet.
 */
export const authenticate: RequestHandler = async (req, _res, next) => {
  const header = req.header('authorization');

  if (!header) {
    throw AppError.unauthorized('Missing Authorization header');
  }

  const [scheme, token] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
    throw AppError.unauthorized('Authorization header must use the Bearer scheme');
  }

  const claims = verifyAccessToken(token);

  const user = await AppDataSource.getRepository(User).findOne({
    where: { id: claims.sub },
  });

  if (!user) {
    throw AppError.unauthorized('The user linked to this token no longer exists', 'INVALID_TOKEN');
  }

  if (!user.isActive) {
    throw AppError.forbidden('User account is disabled');
  }

  req.user = {
    id: user.id,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
  };

  next();
};

/** Returns the authenticated user or fails; use inside protected handlers. */
export function requireUser(req: { user?: AuthenticatedUser }): AuthenticatedUser {
  if (!req.user) {
    throw AppError.unauthorized();
  }
  return req.user;
}
