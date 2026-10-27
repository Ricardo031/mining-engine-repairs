import 'reflect-metadata';
import { createApp } from './app';
import { AppDataSource } from './config/data-source';
import { env } from './config/env';
import { logger } from './config/logger';
import { ensureSeedAdmin } from './db/seed-admin';

async function bootstrap(): Promise<void> {
  await AppDataSource.initialize();
  logger.info('Database connection established');

  if (env.SEED_ADMIN_ENABLED) {
    await ensureSeedAdmin();
  }

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, environment: env.NODE_ENV },
      `Auth service listening on http://localhost:${env.PORT}`,
    );
  });

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'Shutting down gracefully');
    server.close(() => {
      void AppDataSource.destroy().finally(() => process.exit(0));
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((error) => {
  logger.fatal({ err: error }, 'Failed to start auth service');
  process.exit(1);
});
