import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env';
import { AppError } from '../common/errors';
import type { User, UserRole } from '../db/entities/user.entity';

function loadKey(filePath: string, label: string): string {
  const absolutePath = path.resolve(process.cwd(), filePath);
  try {
    return readFileSync(absolutePath, 'utf8');
  } catch {
    throw new Error(
      `Cannot read ${label} at "${absolutePath}". ` +
        'Generate the RSA key pair with "npm run keys:generate" or set the *_PATH variables.',
    );
  }
}

const privateKey = loadKey(env.JWT_PRIVATE_KEY_PATH, 'JWT private key');
const publicKey = loadKey(env.JWT_PUBLIC_KEY_PATH, 'JWT public key');

const payloadSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['admin', 'operator']),
  type: z.literal('access'),
  jti: z.string().optional(),
  iat: z.number().optional(),
  exp: z.number().optional(),
  iss: z.string().optional(),
  aud: z.union([z.string(), z.array(z.string())]).optional(),
});

export type AccessTokenClaims = z.infer<typeof payloadSchema>;

export interface SignedAccessToken {
  token: string;
  expiresIn: number;
}

export function signAccessToken(user: Pick<User, 'id' | 'email' | 'role'>): SignedAccessToken {
  const options: SignOptions = {
    algorithm: 'RS256',
    subject: user.id,
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    expiresIn: env.JWT_EXPIRES_IN_SECONDS,
    jwtid: randomUUID(),
  };

  const token = jwt.sign(
    { email: user.email, role: user.role satisfies UserRole, type: 'access' },
    privateKey,
    options,
  );

  return { token, expiresIn: env.JWT_EXPIRES_IN_SECONDS };
}

/**
 * Verifies signature, issuer, audience and expiration. Decoding alone is
 * never enough: the signature is checked with the RSA public key.
 */
export function verifyAccessToken(token: string): AccessTokenClaims {
  let decoded: string | JwtPayload;

  try {
    decoded = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw AppError.unauthorized('Access token has expired', 'TOKEN_EXPIRED');
    }
    if (error instanceof jwt.NotBeforeError) {
      throw AppError.unauthorized('Access token is not active yet', 'INVALID_TOKEN');
    }
    throw AppError.unauthorized('Invalid access token', 'INVALID_TOKEN');
  }

  if (typeof decoded === 'string') {
    throw AppError.unauthorized('Invalid access token payload', 'INVALID_TOKEN');
  }

  const parsed = payloadSchema.safeParse(decoded);
  if (!parsed.success) {
    throw AppError.unauthorized('Invalid access token payload', 'INVALID_TOKEN');
  }

  return parsed.data;
}
