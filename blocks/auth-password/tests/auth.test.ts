import { describe, expect, it, vi } from 'vitest';
import {
  cleanupExpiredSessions,
  createSession,
  deleteSession,
  hashPassword,
  validateSession,
  verifyPassword,
} from '../server/auth';

// Mock PrismaClient
vi.mock('@prisma/client', () => {
  const mockSession = {
    id: 'session-1',
    token: 'test-token',
    userId: 'user-1',
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    user: {
      id: 'user-1',
      username: 'testuser',
      password: 'hashed',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  return {
    PrismaClient: vi.fn(() => ({
      session: {
        create: vi.fn().mockResolvedValue(mockSession),
        findUnique: vi.fn().mockResolvedValue(mockSession),
        delete: vi.fn().mockResolvedValue(mockSession),
        deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
    })),
  };
});

describe('Auth Core Functions', () => {
  describe('hashPassword', () => {
    it('should hash a password', async () => {
      const password = 'mypassword123';
      const hash = await hashPassword(password);

      expect(hash).toBeTruthy();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
    });

    it('should produce different hashes for same password', async () => {
      const password = 'mypassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'mypassword123';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'mypassword123';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword('wrongpassword', hash);

      expect(isValid).toBe(false);
    });
  });

  describe('createSession', () => {
    it('should create a session and return token', async () => {
      const userId = 'user-1';
      const token = await createSession(userId);

      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64); // 32 bytes = 64 hex chars
    });
  });

  describe('validateSession', () => {
    it('should return user for valid session', async () => {
      const token = 'valid-token';
      const user = await validateSession(token);

      expect(user).toBeTruthy();
      expect(user?.username).toBe('testuser');
    });
  });

  describe('deleteSession', () => {
    it('should delete session without throwing', async () => {
      const token = 'test-token';
      await expect(deleteSession(token)).resolves.not.toThrow();
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should return count of deleted sessions', async () => {
      const count = await cleanupExpiredSessions();
      expect(count).toBe(2);
    });
  });
});
