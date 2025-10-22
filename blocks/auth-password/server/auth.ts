import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from './lib/prisma';

const SALT_ROUNDS = 10;
const SESSION_DURATION_DAYS = 30;
const SESSION_TOKEN_BYTES = 32; // 32 bytes = 256 bits of entropy (OWASP recommendation)

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a bcrypt hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Create a new session for a user
 * @returns Session token
 */
export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(SESSION_TOKEN_BYTES).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  await prisma.session.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  return token;
}

/**
 * Validate a session token and return the associated user
 * @returns User object if valid, null if invalid/expired
 */
export async function validateSession(token: string) {
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session) {
    return null;
  }

  // Check if session is expired
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  return session.user;
}

/**
 * Delete a session (logout)
 */
export async function deleteSession(token: string): Promise<void> {
  await prisma.session.delete({ where: { token } }).catch(() => {
    // Ignore errors if session doesn't exist
  });
}

/**
 * Delete all expired sessions (cleanup utility)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });
  return result.count;
}
