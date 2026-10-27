import rateLimit from 'express-rate-limit';
import { ERROR_CODES } from '../common/errors';

type RateLimitOptions = Parameters<typeof rateLimit>[0];

/** JSON 429 responses, consistent with the global error format. */
export function createRateLimiter(options: RateLimitOptions) {
  return rateLimit({
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: ERROR_CODES.RATE_LIMITED,
          message: 'Too many requests. Please try again later.',
          requestId: res.locals.requestId,
        },
      });
    },
    ...options,
  });
}
