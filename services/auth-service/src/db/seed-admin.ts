import { logger } from '../config/logger';
import { env } from '../config/env';
import { AppDataSource } from '../config/data-source';
import { hashPassword } from '../utils/password';
import { User } from './entities/user.entity';

/**
 * Idempotent bootstrap: creates the first admin only when there is no admin
 * in the database. Safe to run on every container start.
 */
export async function ensureSeedAdmin(): Promise<void> {
  if (!env.SEED_ADMIN_ENABLED) return;

  const email = env.SEED_ADMIN_EMAIL;
  const password = env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    logger.warn('SEED_ADMIN_ENABLED=true but credentials are missing; skipping seed');
    return;
  }

  const repository = AppDataSource.getRepository(User);

  if (await repository.exists({ where: { role: 'admin' } })) {
    logger.debug('Seed admin skipped: an administrator already exists');
    return;
  }

  if (await repository.exists({ where: { email: email.toLowerCase() } })) {
    logger.warn(
      { email },
      'Seed admin skipped: the email exists but does not have the admin role',
    );
    return;
  }

  const admin = repository.create({
    email: email.toLowerCase(),
    firstName: env.SEED_ADMIN_FIRST_NAME,
    lastName: env.SEED_ADMIN_LAST_NAME,
    role: 'admin',
    passwordHash: await hashPassword(password),
  });

  await repository.save(admin);

  logger.info({ email: admin.email }, 'Initial administrator created');
}
