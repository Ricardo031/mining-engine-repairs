import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Express } from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { AppDataSource } from '../src/config/data-source';
import { env } from '../src/config/env';
import { User, type UserRole } from '../src/db/entities/user.entity';
import { hashPassword } from '../src/utils/password';

/** Drops every table and rebuilds the schema with the real migrations. */
export async function resetDatabase(): Promise<void> {
  if (!AppDataSource.isInitialized) await AppDataSource.initialize();
  await AppDataSource.dropDatabase();
  await AppDataSource.runMigrations();
}

interface NewUser {
  email: string;
  password: string;
  role?: UserRole;
  isActive?: boolean;
  firstName?: string;
  lastName?: string;
}

/** Inserts a user straight into the database (bypassing the API). */
export async function insertUser(data: NewUser): Promise<User> {
  const repository = AppDataSource.getRepository(User);
  return repository.save(
    repository.create({
      email: data.email,
      firstName: data.firstName ?? 'Test',
      lastName: data.lastName ?? 'User',
      role: data.role ?? 'operator',
      isActive: data.isActive ?? true,
      passwordHash: await hashPassword(data.password),
    }),
  );
}

export async function login(app: Express, email: string, password: string): Promise<string> {
  const response = await request(app).post('/api/v1/auth/login').send({ email, password });
  if (response.status !== 200) {
    throw new Error(
      `Login failed for ${email}: ${response.status} ${JSON.stringify(response.body)}`,
    );
  }
  return response.body.data.accessToken as string;
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/**
 * Signs a token by hand, like the auth service would, but lets tests change
 * the claims or the key (expired tokens, foreign keys...).
 */
export function signToken(
  user: Pick<User, 'id' | 'email' | 'role'>,
  options: { expiresInSeconds?: number; privateKey?: string } = {},
): string {
  const privateKey =
    options.privateKey ??
    readFileSync(path.resolve(process.cwd(), env.JWT_PRIVATE_KEY_PATH), 'utf8');
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      email: user.email,
      role: user.role,
      type: 'access',
      iat: now - 120,
      exp: now + (options.expiresInSeconds ?? 3600),
    },
    privateKey,
    {
      algorithm: 'RS256',
      subject: user.id,
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      jwtid: randomUUID(),
    },
  );
}

export function foreignPrivateKey(): string {
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  return privateKey;
}
