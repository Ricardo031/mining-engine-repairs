import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { AppDataSource } from '../../src/config/data-source';
import { User } from '../../src/db/entities/user.entity';
import { createApp } from '../../src/app';

describe('Auth service (integration)', () => {
  let app: ReturnType<typeof createApp>;
  let adminToken: string;

  beforeAll(async () => {
    app = createApp();
    await AppDataSource.initialize();
    // Rebuild the schema from the real migrations so tests match production.
    await AppDataSource.dropDatabase();
    await AppDataSource.runMigrations();
    await AppDataSource.getRepository(User).query('DELETE FROM users');

    const bcrypt = (await import('bcryptjs')).default;
    const repository = AppDataSource.getRepository(User);
    const admin = repository.create({
      email: 'admin@mining-repairs.local',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      isActive: true,
      passwordHash: await bcrypt.hash('Admin1234', 12),
    });
    await repository.save(admin);
  });

  afterAll(async () => {
    await AppDataSource.destroy();
  });

  describe('GET /health', () => {
    it('returns ok status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ status: 'ok', service: 'auth-service' });
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('rejects unknown credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'ghost@mining-repairs.local', password: 'Wrong1234' });

      expect(response.status).toBe(401);
      expect(response.body.error).toMatchObject({ code: 'INVALID_CREDENTIALS' });
    });

    it('rejects a wrong password for the seeded admin', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@mining-repairs.local', password: 'Wrong1234' });

      expect(response.status).toBe(401);
    });

    it('returns an access token for valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@mining-repairs.local', password: 'Admin1234' });

      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        tokenType: 'Bearer',
        user: { email: 'admin@mining-repairs.local', role: 'admin' },
      });

      adminToken = response.body.data.accessToken;
      expect(typeof adminToken).toBe('string');
    });
  });

  describe('GET /api/v1/users', () => {
    it('rejects unauthenticated requests', async () => {
      const response = await request(app).get('/api/v1/users');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('lists users for an authenticated admin', async () => {
      const response = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].email).toBe('admin@mining-repairs.local');
    });
  });

  describe('POST /api/v1/users', () => {
    it('creates a user as an authenticated admin', async () => {
      const response = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'operator@mining-repairs.local',
          password: 'Operator123',
          firstName: 'Operator',
          lastName: 'One',
          role: 'operator',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.email).toBe('operator@mining-repairs.local');
    });

    it('returns 409 when the email is already registered', async () => {
      const response = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'admin@mining-repairs.local',
          password: 'Operator123',
          firstName: 'Dup',
          lastName: 'User',
        });

      expect(response.status).toBe(409);
    });
  });
});
