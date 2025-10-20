/**
 * Strategy Validation Tests
 *
 * Tests that only implemented strategies are accepted and unimplemented
 * strategies are properly rejected at the validation layer.
 */

import { StartGenerationSchema } from '@gen-fullstack/shared';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

describe('Strategy Validation', () => {
  describe('StartGenerationSchema', () => {
    it('should accept implemented strategy: naive', () => {
      const result = StartGenerationSchema.safeParse({
        prompt: 'Build a todo app',
        strategy: 'naive',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.strategy).toBe('naive');
      }
    });

    it('should accept implemented strategy: plan-first', () => {
      const result = StartGenerationSchema.safeParse({
        prompt: 'Build a todo app',
        strategy: 'plan-first',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.strategy).toBe('plan-first');
      }
    });

    it('should accept implemented strategy: template', () => {
      const result = StartGenerationSchema.safeParse({
        prompt: 'Build a todo app',
        strategy: 'template',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.strategy).toBe('template');
      }
    });

    it('should accept implemented strategy: compiler-check', () => {
      const result = StartGenerationSchema.safeParse({
        prompt: 'Build a todo app',
        strategy: 'compiler-check',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.strategy).toBe('compiler-check');
      }
    });

    it('should reject unimplemented strategy: building-blocks', () => {
      const result = StartGenerationSchema.safeParse({
        prompt: 'Build a todo app',
        strategy: 'building-blocks',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ZodError);
        expect(result.error.issues[0].path).toEqual(['strategy']);
        expect(result.error.issues[0].message).toContain('Invalid enum value');
      }
    });

    it('should reject unknown strategy', () => {
      const result = StartGenerationSchema.safeParse({
        prompt: 'Build a todo app',
        strategy: 'unknown-strategy',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ZodError);
        expect(result.error.issues[0].path).toEqual(['strategy']);
      }
    });

    it('should reject empty prompt', () => {
      const result = StartGenerationSchema.safeParse({
        prompt: '',
        strategy: 'naive',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(['prompt']);
      }
    });

    it('should reject missing prompt', () => {
      const result = StartGenerationSchema.safeParse({
        strategy: 'naive',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(['prompt']);
      }
    });

    it('should reject missing strategy', () => {
      const result = StartGenerationSchema.safeParse({
        prompt: 'Build a todo app',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(['strategy']);
      }
    });
  });
});
