import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { env } from './env';
import { User } from '../db/entities/user.entity';
import { CreateUsers1760000000000 } from '../db/migrations/1760000000000-CreateUsers';

/**
 * Single TypeORM DataSource for the auth service.
 *
 * `synchronize` is always disabled: the schema is versioned through
 * migrations so every environment has a reproducible database.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: env.DB_HOST,
  port: env.DB_PORT,
  username: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  ssl: env.DB_SSL ? { rejectUnauthorized: false } : false,
  entities: [User],
  migrations: [CreateUsers1760000000000],
  migrationsRun: env.DB_MIGRATIONS_RUN,
  synchronize: false,
  logging: env.DB_LOGGING ? ['query', 'error', 'schema'] : ['error'],
  extra: {
    max: 10,
    connectionTimeoutMillis: 10_000,
  },
});
