import bcrypt from 'bcryptjs';
import { env } from '../config/env';

export function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, env.BCRYPT_ROUNDS);
}

export function verifyPassword(plainPassword: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, passwordHash);
}

/**
 * Constant hash used to keep login timing similar when the email does not
 * exist, reducing user-enumeration through response time differences.
 */
export const DUMMY_PASSWORD_HASH = bcrypt.hashSync('not-a-real-password', env.BCRYPT_ROUNDS);
