import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { AppDataSource } from '../../src/config/data-source';
import type { User } from '../../src/db/entities/user.entity';
import { bearer, foreignPrivateKey, insertUser, login, resetDatabase, signToken } from '../helpers';

const ADMIN = { email: 'boss@mining-repairs.local', password: 'Admin1234' };
const OPERATOR = { email: 'tech@mining-repairs.local', password: 'Operator123' };

describe('Users, roles and tokens (integration)', () => {
  let app: Express;
  let admin: User;
  let operator: User;
  let adminToken: string;
  let operatorToken: string;

  beforeAll(async () => {
    app = createApp();
    await resetDatabase();
  });

  // Every test starts with exactly one admin and one operator.
  beforeEach(async () => {
    await AppDataSource.query('DELETE FROM users');
    admin = await insertUser({ ...ADMIN, role: 'admin', firstName: 'Ana' });
    operator = await insertUser({ ...OPERATOR, role: 'operator', firstName: 'Tomás' });
    adminToken = signToken(admin);
    operatorToken = signToken(operator);
  });

  afterAll(async () => {
    await AppDataSource.destroy();
  });

  describe('role based access', () => {
    it.each([
      ['GET', '/api/v1/users'],
      ['POST', '/api/v1/users'],
      ['POST', '/api/v1/auth/register'],
      ['GET', '/api/v1/users/00000000-0000-4000-8000-000000000000'],
      ['PATCH', '/api/v1/users/00000000-0000-4000-8000-000000000000'],
      ['DELETE', '/api/v1/users/00000000-0000-4000-8000-000000000000'],
    ])('operator gets 403 on %s %s', async (method, url) => {
      const agent = request(app)[method.toLowerCase() as 'get' | 'post' | 'patch' | 'delete'](url);
      const response = await agent.set(bearer(operatorToken)).send({});

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('operator can read and update their own profile', async () => {
      const me = await request(app).get('/api/v1/users/me').set(bearer(operatorToken));
      expect(me.status).toBe(200);
      expect(me.body.data).toMatchObject({ email: OPERATOR.email, role: 'operator' });

      const updated = await request(app)
        .patch('/api/v1/users/me')
        .set(bearer(operatorToken))
        .send({ firstName: 'Tomas Andres' });
      expect(updated.status).toBe(200);
      expect(updated.body.data.firstName).toBe('Tomas Andres');
    });

    it('operator cannot promote themselves through /users/me', async () => {
      const response = await request(app)
        .patch('/api/v1/users/me')
        .set(bearer(operatorToken))
        .send({ role: 'admin' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('user administration', () => {
    it('admin registers a user that can log in right away', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .set(bearer(adminToken))
        .send({
          email: 'New.User@Mining-Repairs.local',
          password: 'Welcome123',
          firstName: 'Nuevo',
          lastName: 'Usuario',
        });

      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        email: 'new.user@mining-repairs.local', // stored in lower case
        role: 'operator', // default role
        isActive: true,
      });
      expect(response.body.data).not.toHaveProperty('passwordHash');

      await expect(login(app, 'new.user@mining-repairs.local', 'Welcome123')).resolves.toEqual(
        expect.any(String),
      );
    });

    it('rejects weak passwords and invalid emails with field details', async () => {
      const response = await request(app)
        .post('/api/v1/users')
        .set(bearer(adminToken))
        .send({ email: 'not-an-email', password: 'short', firstName: 'A', lastName: 'B' });

      expect(response.status).toBe(400);
      const paths = response.body.error.details.map((d: { path: string }) => d.path);
      expect(paths).toEqual(
        expect.arrayContaining(['body.email', 'body.password', 'body.firstName', 'body.lastName']),
      );
    });

    it('admin gets and updates another user, including the role', async () => {
      const found = await request(app).get(`/api/v1/users/${operator.id}`).set(bearer(adminToken));
      expect(found.status).toBe(200);
      expect(found.body.data.email).toBe(OPERATOR.email);

      const updated = await request(app)
        .patch(`/api/v1/users/${operator.id}`)
        .set(bearer(adminToken))
        .send({ lastName: 'Gómez', role: 'admin' });
      expect(updated.status).toBe(200);
      expect(updated.body.data).toMatchObject({ lastName: 'Gómez', role: 'admin' });
    });

    it('returns 409 when changing to an email that is already taken', async () => {
      const response = await request(app)
        .patch(`/api/v1/users/${operator.id}`)
        .set(bearer(adminToken))
        .send({ email: ADMIN.email });

      expect(response.status).toBe(409);
    });

    it('returns 404 for unknown users and 400 for malformed ids', async () => {
      const missing = await request(app)
        .get('/api/v1/users/00000000-0000-4000-8000-000000000000')
        .set(bearer(adminToken));
      expect(missing.status).toBe(404);

      const malformed = await request(app).get('/api/v1/users/not-a-uuid').set(bearer(adminToken));
      expect(malformed.status).toBe(400);
    });

    it('filters the user list by role and search text', async () => {
      const response = await request(app)
        .get('/api/v1/users')
        .query({ role: 'operator', search: 'tech' })
        .set(bearer(adminToken));

      expect(response.status).toBe(200);
      expect(response.body.data.map((u: { email: string }) => u.email)).toEqual([OPERATOR.email]);
      expect(response.body.meta).toMatchObject({ page: 1, total: 1 });
    });

    it('admin cannot change their own role or deactivate themselves', async () => {
      const ownRole = await request(app)
        .patch(`/api/v1/users/${admin.id}`)
        .set(bearer(adminToken))
        .send({ role: 'operator' });
      expect(ownRole.status).toBe(403);

      const ownDeactivation = await request(app)
        .delete(`/api/v1/users/${admin.id}`)
        .set(bearer(adminToken));
      expect(ownDeactivation.status).toBe(403);
    });
  });

  describe('deactivated users', () => {
    it('cannot log in and their existing token stops working', async () => {
      const deactivated = await request(app)
        .delete(`/api/v1/users/${operator.id}`)
        .set(bearer(adminToken));
      expect(deactivated.status).toBe(200);
      expect(deactivated.body.data.isActive).toBe(false);

      // Same generic message as a wrong password: it does not reveal the account state.
      const loginAttempt = await request(app).post('/api/v1/auth/login').send(OPERATOR);
      expect(loginAttempt.status).toBe(401);
      expect(loginAttempt.body.error.code).toBe('INVALID_CREDENTIALS');

      // A token issued before the deactivation is rejected on the next request.
      const withOldToken = await request(app).get('/api/v1/users/me').set(bearer(operatorToken));
      expect(withOldToken.status).toBe(403);
    });

    it('can log in again after being reactivated', async () => {
      await request(app).delete(`/api/v1/users/${operator.id}`).set(bearer(adminToken));
      const reactivated = await request(app)
        .patch(`/api/v1/users/${operator.id}`)
        .set(bearer(adminToken))
        .send({ isActive: true });
      expect(reactivated.body.data.isActive).toBe(true);

      await expect(login(app, OPERATOR.email, OPERATOR.password)).resolves.toEqual(
        expect.any(String),
      );
    });
  });

  describe('change password', () => {
    const url = '/api/v1/users/me/change-password';

    it('requires the current password', async () => {
      const response = await request(app)
        .post(url)
        .set(bearer(operatorToken))
        .send({ currentPassword: 'Wrong1234', newPassword: 'Brand-new-123' });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('rejects reusing the same password', async () => {
      const response = await request(app)
        .post(url)
        .set(bearer(operatorToken))
        .send({ currentPassword: OPERATOR.password, newPassword: OPERATOR.password });

      expect(response.status).toBe(400);
    });

    it('changes the password: the new one works and the old one does not', async () => {
      const response = await request(app)
        .post(url)
        .set(bearer(operatorToken))
        .send({ currentPassword: OPERATOR.password, newPassword: 'Brand-new-123' });
      expect(response.status).toBe(204);

      await expect(login(app, OPERATOR.email, 'Brand-new-123')).resolves.toEqual(
        expect.any(String),
      );
      const oldPassword = await request(app).post('/api/v1/auth/login').send(OPERATOR);
      expect(oldPassword.status).toBe(401);
    });
  });

  describe('token validation', () => {
    it('rejects an expired token with TOKEN_EXPIRED', async () => {
      const expired = signToken(admin, { expiresInSeconds: -60 });
      const response = await request(app).get('/api/v1/auth/me').set(bearer(expired));

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('TOKEN_EXPIRED');
    });

    it('rejects a token signed with a different key', async () => {
      const forged = signToken(admin, { privateKey: foreignPrivateKey() });
      const response = await request(app).get('/api/v1/auth/me').set(bearer(forged));

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('rejects a token whose payload was edited to gain the admin role', async () => {
      const [header, , signature] = operatorToken.split('.');
      const fakePayload = Buffer.from(
        JSON.stringify({
          ...JSON.parse(Buffer.from(operatorToken.split('.')[1]!, 'base64url').toString()),
          role: 'admin',
        }),
      ).toString('base64url');

      const response = await request(app)
        .get('/api/v1/users')
        .set(bearer(`${header}.${fakePayload}.${signature}`));

      expect(response.status).toBe(401);
    });

    it('rejects a token for a user that no longer exists', async () => {
      await AppDataSource.query('DELETE FROM users WHERE id = $1', [operator.id]);
      const response = await request(app).get('/api/v1/auth/me').set(bearer(operatorToken));

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    it('rejects headers that do not use the Bearer scheme', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Basic ${adminToken}`);

      expect(response.status).toBe(401);
    });
  });
});
