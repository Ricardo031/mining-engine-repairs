import type { RequestHandler } from 'express';
import { AppError } from '../common/errors';
import type { UserRole } from '../db/entities/user.entity';

/** Role-based access control. Must run after `authenticate`. */
export function authorize(...allowedRoles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      throw AppError.unauthorized();
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw AppError.forbidden(
        `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
      );
    }

    next();
  };
}
