import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

// Load .env.test when running the test suite, .env otherwise.
// Real environment variables (Docker, CI) always take precedence.
const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

const booleanString = (defaultValue: 'true' | 'false') =>
  z
    .enum(['true', 'false'])
    .default(defaultValue)
    .transform((value) => value === 'true');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    CORS_ORIGINS: z.string().default('http://localhost:5173'),

    DB_HOST: z.string().min(1).default('localhost'),
    DB_PORT: z.coerce.number().int().min(1).max(65535).default(5432),
    DB_NAME: z.string().min(1).default('auth_db'),
    DB_USER: z.string().min(1),
    DB_PASSWORD: z.string().min(1),
    DB_SSL: booleanString('false'),
    DB_LOGGING: booleanString('false'),
    DB_MIGRATIONS_RUN: booleanString('false'),

    JWT_PRIVATE_KEY_PATH: z.string().min(1).default('../../keys/jwt-private.pem'),
    JWT_PUBLIC_KEY_PATH: z.string().min(1).default('../../keys/jwt-public.pem'),
    JWT_ISSUER: z.string().min(1).default('mining-repairs-auth'),
    JWT_AUDIENCE: z.string().min(1).default('mining-repairs-api'),
    JWT_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().default(3600),

    BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),

    SEED_ADMIN_ENABLED: booleanString('false'),
    SEED_ADMIN_EMAIL: z.string().email().optional(),
    SEED_ADMIN_PASSWORD: z.string().min(8).max(72).optional(),
    SEED_ADMIN_FIRST_NAME: z.string().min(1).default('System'),
    SEED_ADMIN_LAST_NAME: z.string().min(1).default('Administrator'),
  })
  .superRefine((data, ctx) => {
    if (!data.SEED_ADMIN_ENABLED) return;
    if (!data.SEED_ADMIN_EMAIL) {
      ctx.addIssue({
        code: 'custom',
        path: ['SEED_ADMIN_EMAIL'],
        message: 'is required when SEED_ADMIN_ENABLED=true',
      });
    }
    if (!data.SEED_ADMIN_PASSWORD) {
      ctx.addIssue({
        code: 'custom',
        path: ['SEED_ADMIN_PASSWORD'],
        message: 'is required when SEED_ADMIN_ENABLED=true',
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  const message = `Invalid environment configuration:\n${details}`;

  if (process.env.NODE_ENV === 'test') {
    throw new Error(message);
  }

  console.error(message);
  process.exit(1);
}

export const env = parsed.data;

export const corsOrigins = env.CORS_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
