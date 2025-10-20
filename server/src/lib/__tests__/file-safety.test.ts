import { describe, expect, it } from 'vitest';
import { checkFileSafety } from '../file-safety.js';

describe('File Safety Checks', () => {
  describe('checkFileSafety', () => {
    it('should flag 60% code reduction as unsafe', () => {
      const oldContent = 'x'.repeat(1000);
      const newContent = 'x'.repeat(400);

      const result = checkFileSafety(oldContent, newContent, 'test.ts');

      expect(result.isSafe).toBe(false);
      expect(result.reductionPercent).toBe(60);
      expect(result.oldSize).toBe(1000);
      expect(result.newSize).toBe(400);
      expect(result.warning).toContain('60% less code');
      expect(result.warning).toContain('test.ts');
    });

    it('should flag 50% code reduction as unsafe (at threshold)', () => {
      const oldContent = 'x'.repeat(1000);
      const newContent = 'x'.repeat(500);

      const result = checkFileSafety(oldContent, newContent, 'server/index.ts');

      expect(result.isSafe).toBe(false);
      expect(result.reductionPercent).toBe(50);
      expect(result.warning).toContain('50% less code');
    });

    it('should allow 49% code reduction as safe (just below threshold)', () => {
      const oldContent = 'x'.repeat(1000);
      const newContent = 'x'.repeat(510);

      const result = checkFileSafety(oldContent, newContent, 'test.ts');

      expect(result.isSafe).toBe(true);
      expect(result.reductionPercent).toBe(49);
      expect(result.warning).toBeUndefined();
    });

    it('should allow code increases as safe', () => {
      const oldContent = 'x'.repeat(500);
      const newContent = 'x'.repeat(1000);

      const result = checkFileSafety(oldContent, newContent, 'test.ts');

      expect(result.isSafe).toBe(true);
      expect(result.reductionPercent).toBe(-100); // Negative means increase
      expect(result.warning).toBeUndefined();
    });

    it('should allow small reductions as safe', () => {
      const oldContent = 'x'.repeat(1000);
      const newContent = 'x'.repeat(900);

      const result = checkFileSafety(oldContent, newContent, 'test.ts');

      expect(result.isSafe).toBe(true);
      expect(result.reductionPercent).toBe(10);
      expect(result.warning).toBeUndefined();
    });

    it('should allow code reduction for small files (under 100 chars)', () => {
      const oldContent = 'x'.repeat(50);
      const newContent = 'x'.repeat(10);

      const result = checkFileSafety(oldContent, newContent, 'small.ts');

      expect(result.isSafe).toBe(true);
      expect(result.reductionPercent).toBe(0); // Not calculated for small files
      expect(result.warning).toBeUndefined();
    });

    it('should flag complete deletion (100% reduction)', () => {
      const oldContent = 'x'.repeat(500);
      const newContent = '';

      const result = checkFileSafety(oldContent, newContent, 'test.ts');

      expect(result.isSafe).toBe(false);
      expect(result.reductionPercent).toBe(100);
      expect(result.oldSize).toBe(500);
      expect(result.newSize).toBe(0);
      expect(result.warning).toContain('100% less code');
    });

    it('should handle edge case of exactly 100 chars (boundary)', () => {
      const oldContent = 'x'.repeat(100);
      const newContent = 'x'.repeat(40);

      const result = checkFileSafety(oldContent, newContent, 'test.ts');

      // At exactly 100 chars, check should be skipped
      expect(result.isSafe).toBe(true);
      expect(result.reductionPercent).toBe(0);
    });

    it('should trigger check at 101 chars', () => {
      const oldContent = 'x'.repeat(101);
      const newContent = 'x'.repeat(40);

      const result = checkFileSafety(oldContent, newContent, 'test.ts');

      // Above 100 chars, check should trigger
      expect(result.isSafe).toBe(false);
      expect(result.reductionPercent).toBe(60);
    });

    it('should handle same size replacement as safe', () => {
      const oldContent = 'const foo = "old value";';
      const newContent = 'const foo = "new value";';

      const result = checkFileSafety(oldContent, newContent, 'test.ts');

      expect(result.isSafe).toBe(true);
      expect(result.reductionPercent).toBe(0);
      expect(result.oldSize).toBe(result.newSize);
    });

    it('should include file path in warning message', () => {
      const oldContent = 'x'.repeat(1000);
      const newContent = 'x'.repeat(300);

      const result = checkFileSafety(oldContent, newContent, 'server/src/index.ts');

      expect(result.warning).toContain('server/src/index.ts');
    });

    it('should return all metadata even when safe', () => {
      const oldContent = 'x'.repeat(500);
      const newContent = 'x'.repeat(400);

      const result = checkFileSafety(oldContent, newContent, 'test.ts');

      expect(result).toHaveProperty('isSafe');
      expect(result).toHaveProperty('oldSize', 500);
      expect(result).toHaveProperty('newSize', 400);
      expect(result).toHaveProperty('reductionPercent', 20);
    });

    it('should handle realistic code replacement scenario', () => {
      // Simulate the session 23cb4890 scenario:
      // Full Express server replaced with 58-line stub
      const expressServer = `
import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// REST API endpoints (7 routes)
app.get('/api/users', async (req, res) => { /* ... */ });
app.post('/api/users', async (req, res) => { /* ... */ });
// ... more routes
`.repeat(20); // Realistic size: ~3000+ chars

      const stub = `
export type User = { id: number; email: string; };
export type Entry = { id: number; userId: number; };
let users: User[] = [];
export function createUser(email: string): User { return { id: 1, email }; }
`.repeat(2); // Stub: ~300 chars

      const result = checkFileSafety(expressServer, stub, 'server/src/index.ts');

      expect(result.isSafe).toBe(false);
      expect(result.reductionPercent).toBeGreaterThan(80); // Massive reduction
      expect(result.warning).toContain('server/src/index.ts');
    });
  });
});
