import { describe, expect, it } from 'vitest';
import { AppError } from '../../src/common/errors';
import { signAccessToken, verifyAccessToken } from '../../src/utils/jwt';

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'admin@mining-repairs.local',
  role: 'admin' as const,
};

describe('JWT access tokens', () => {
  it('signs and verifies an access token roundtrip', () => {
    const { token, expiresIn } = signAccessToken(user);

    expect(typeof token).toBe('string');
    expect(expiresIn).toBeGreaterThan(0);

    const claims = verifyAccessToken(token);
    expect(claims.sub).toBe(user.id);
    expect(claims.email).toBe(user.email);
    expect(claims.role).toBe('admin');
    expect(claims.type).toBe('access');
  });

  it('rejects a token whose signature does not match', () => {
    const { token } = signAccessToken(user);
    const [header, payload, signature] = token.split('.') as [string, string, string];
    const tamperedSignature = `${signature.slice(0, -4)}AAAA`;

    expect(() => verifyAccessToken(`${header}.${payload}.${tamperedSignature}`)).toThrow(AppError);
  });
});
