import { PrismaClient } from '@prisma/client';

/**
 * Prisma Client singleton pattern
 *
 * Prevents multiple instances which can exhaust database connection pool.
 * Uses global object in development to survive hot module reloading.
 *
 * @see https://www.prisma.io/docs/guides/performance-and-optimization/connection-management
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
