/**
 * Generation Validation Tests
 *
 * Tests that the StartGenerationSchema properly validates capability-based
 * generation payloads and rejects invalid inputs.
 */

import { StartGenerationSchema } from '@gen-fullstack/shared';
import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';

describe('Generation Validation', () => {
  describe('StartGenerationSchema', () => {
    it("should accept valid configuration with inputMode: 'naive'", () => {
      const result = StartGenerationSchema.safeParse({
        prompt: 'Build a todo app',
        config: {
          inputMode: 'naive',
        },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.config.inputMode).toBe('naive');
        expect(result.data.model).toBe('gpt-5-mini'); // default
      }
    });

    it('should accept valid configuration with planning capability', () => {
      const result = StartGenerationSchema.safeParse({
        prompt: 'Build a todo app',
        config: {
          inputMode: 'naive',
          planning: true,
        },
        model: 'gpt-5',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.config.inputMode).toBe('naive');
        expect(result.data.config.planning).toBe(true);
        expect(result.data.model).toBe('gpt-5');
      }
    });

    it("should accept configuration with inputMode: 'template' and template options", () => {
      const result = StartGenerationSchema.safeParse({
        prompt: 'Customize the template',
        config: {
          inputMode: 'template',
          templateOptions: {
            templateName: 'vite-fullstack-base',
          },
        },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.config.inputMode).toBe('template');
        expect(result.data.config.templateOptions?.templateName).toBe('vite-fullstack-base');
      }
    });

    it('should accept compiler checks configuration', () => {
      const result = StartGenerationSchema.safeParse({
        prompt: 'Build a todo app',
        config: {
          inputMode: 'naive',
          compilerChecks: true,
        },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.config.compilerChecks).toBe(true);
        expect(result.data.config.maxIterations).toBe(3); // default
      }
    });

    it('should accept compiler checks with custom iterations', () => {
      const result = StartGenerationSchema.safeParse({
        prompt: 'Build a todo app',
        config: {
          inputMode: 'naive',
          compilerChecks: true,
          maxIterations: 5,
        },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.config.compilerChecks).toBe(true);
        expect(result.data.config.maxIterations).toBe(5);
      }
    });

    it('should accept full configuration with all capabilities', () => {
      const result = StartGenerationSchema.safeParse({
        prompt: 'Build a todo app',
        config: {
          inputMode: 'template',
          templateOptions: {
            templateName: 'vite-fullstack-base',
          },
          planning: true,
          compilerChecks: true,
          maxIterations: 2,
        },
        model: 'gpt-5-nano',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.config.inputMode).toBe('template');
        expect(result.data.config.planning).toBe(true);
        expect(result.data.config.compilerChecks).toBe(true);
        expect(result.data.config.maxIterations).toBe(2);
        expect(result.data.model).toBe('gpt-5-nano');
      }
    });

    it('should reject empty prompt', () => {
      const result = StartGenerationSchema.safeParse({
        prompt: '',
        config: {
          inputMode: 'naive',
        },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(['prompt']);
      }
    });

    it('should reject missing prompt', () => {
      const result = StartGenerationSchema.safeParse({
        config: {
          inputMode: 'naive',
        },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(['prompt']);
      }
    });

    it('should reject missing config', () => {
      const result = StartGenerationSchema.safeParse({
        prompt: 'Build a todo app',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toEqual(['config']);
      }
    });

    it('should reject invalid input mode', () => {
      const result = StartGenerationSchema.safeParse({
        prompt: 'Build a todo app',
        config: {
          inputMode: 'invalid-mode',
        },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ZodError);
        expect(result.error.issues[0].path).toContain('inputMode');
      }
    });

    it('should reject invalid model', () => {
      const result = StartGenerationSchema.safeParse({
        prompt: 'Build a todo app',
        config: {
          inputMode: 'naive',
        },
        model: 'invalid-model',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ZodError);
        expect(result.error.issues[0].path).toContain('model');
      }
    });

    it('should accept maxIterations even when compiler checks are disabled', () => {
      const result = StartGenerationSchema.safeParse({
        prompt: 'Build a todo app',
        config: {
          inputMode: 'naive',
          compilerChecks: false,
          maxIterations: 2,
        },
      });

      // maxIterations can be specified even if compiler checks are off (it just won't be used)
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.config.compilerChecks).toBe(false);
        expect(result.data.config.maxIterations).toBe(2);
      }
    });
  });
});
