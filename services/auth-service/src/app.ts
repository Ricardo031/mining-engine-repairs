import 'reflect-metadata';
import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { AppError } from './common/errors';
import { AppDataSource } from './config/data-source';
import { corsOrigins } from './config/env';
import { logger } from './config/logger';
import { errorHandler, notFoundHandler } from './middlewares/error-handler';
import { createRateLimiter } from './middlewares/rate-limit';
import { requestId } from './middlewares/request-id';
import { apiRouter } from './routes';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  // One reverse proxy (nginx / docker) in front of the API.
  app.set('trust proxy', 1);

  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (_req, res) => res.locals.requestId as string,
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    }),
  );

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        // Requests without Origin (curl, server-to-server) are allowed.
        if (!origin || corsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(AppError.forbidden(`Origin ${origin} is not allowed by CORS`));
      },
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id', 'RateLimit', 'RateLimit-Policy'],
      credentials: false,
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', async (_req, res) => {
    const databaseUp = AppDataSource.isInitialized
      ? await AppDataSource.query('SELECT 1')
          .then(() => true)
          .catch(() => false)
      : false;

    res.status(databaseUp ? 200 : 503).json({
      status: databaseUp ? 'ok' : 'degraded',
      service: 'auth-service',
      database: databaseUp ? 'up' : 'down',
      timestamp: new Date().toISOString(),
    });
  });

  // Coarse protection for the whole API; login has a stricter limiter.
  app.use(createRateLimiter({ windowMs: 60 * 1000, limit: 300 }));

  app.use('/api/v1', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
