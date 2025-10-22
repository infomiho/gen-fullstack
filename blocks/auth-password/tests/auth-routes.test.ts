import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authRouter } from '../server/auth-routes';

// Mock dependencies
vi.mock('../server/auth', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed-password'),
  verifyPassword: vi.fn().mockResolvedValue(true),
  createSession: vi.fn().mockResolvedValue('session-token-123'),
  deleteSession: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@prisma/client', () => {
  const mockUser = {
    id: 'user-1',
    username: 'testuser',
    password: 'hashed-password',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return {
    PrismaClient: vi.fn(() => ({
      user: {
        findUnique: vi.fn().mockResolvedValue(mockUser),
        create: vi.fn().mockResolvedValue(mockUser),
      },
    })),
  };
});

describe('Auth Routes', () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'newuser',
          password: 'password123',
        })
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.username).toBe('testuser');
      expect(response.body.token).toBe('session-token-123');
    });

    it('should reject missing username', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          password: 'password123',
        })
        .expect(400);

      expect(response.body.error).toContain('required');
    });

    it('should reject missing password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'newuser',
        })
        .expect(400);

      expect(response.body.error).toContain('required');
    });

    it('should reject short username', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'ab',
          password: 'password123',
        })
        .expect(400);

      expect(response.body.error).toContain('3 characters');
    });

    it('should reject short password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'newuser',
          password: '12345',
        })
        .expect(400);

      expect(response.body.error).toContain('6 characters');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'password123',
        })
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.token).toBe('session-token-123');
    });

    it('should reject missing credentials', async () => {
      const response = await request(app).post('/api/auth/login').send({}).expect(400);

      expect(response.body.error).toContain('required');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout with valid token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.message).toContain('Logged out');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body).toHaveProperty('user');
    });

    it('should reject request without token', async () => {
      await request(app).get('/api/auth/me').expect(401);
    });
  });
});
