import { describe, expect, it } from 'vitest';
import { DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from '../../src/utils/password';

describe('password hashing', () => {
  it('hashes and verifies a correct password', async () => {
    const hash = await hashPassword('Str0ngPass123');

    expect(hash).not.toBe('Str0ngPass123');
    expect(await verifyPassword('Str0ngPass123', hash)).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('Str0ngPass123');

    expect(await verifyPassword('WrongPass123', hash)).toBe(false);
  });

  it('produces distinct hashes for the same password (salting)', async () => {
    const hashOne = await hashPassword('Str0ngPass123');
    const hashTwo = await hashPassword('Str0ngPass123');

    expect(hashOne).not.toBe(hashTwo);
  });

  it('exposes a dummy hash for unknown emails without throwing', () => {
    expect(DUMMY_PASSWORD_HASH).toBeTruthy();
  });
});
