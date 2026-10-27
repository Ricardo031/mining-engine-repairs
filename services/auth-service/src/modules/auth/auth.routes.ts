import { Router } from 'express';
import { ERROR_CODES } from '../../common/errors';
import { authenticate } from '../../middlewares/authenticate';
import { authorize } from '../../middlewares/authorize';
import { createRateLimiter } from '../../middlewares/rate-limit';
import { validate } from '../../middlewares/validate';
import { createUserSchema } from '../users/users.schemas';
import { authController } from './auth.controller';
import { loginSchema } from './auth.schemas';

export const authRouter = Router();

/**
 * Brute-force protection: only failed attempts are counted, per IP.
 * In a multi-instance deployment this store should be replaced by Redis.
 */
const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        code: ERROR_CODES.RATE_LIMITED,
        message: 'Too many failed login attempts. Please try again in 15 minutes.',
        requestId: res.locals.requestId,
      },
    });
  },
});

authRouter.post('/login', loginRateLimiter, validate({ body: loginSchema }), authController.login);

authRouter.post(
  '/register',
  authenticate,
  authorize('admin'),
  validate({ body: createUserSchema }),
  authController.register,
);

authRouter.get('/me', authenticate, authController.me);
