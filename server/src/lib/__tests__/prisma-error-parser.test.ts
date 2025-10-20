import { describe, expect, it } from 'vitest';
import { parsePrismaErrors } from '../prisma-error-parser.js';

describe('Prisma Error Parser', () => {
  describe('parsePrismaErrors', () => {
    it('should parse simple error messages', () => {
      const stderr = `
Error: Invalid field type in model User
      `.trim();

      const errors = parsePrismaErrors(stderr);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toBe('Error: Invalid field type in model User');
    });

    it('should parse multi-line error blocks with indented context', () => {
      const stderr = `
Error: Invalid field type in model User
  Field name must be a valid identifier
  Location: schema.prisma:5:3
      `.trim();

      const errors = parsePrismaErrors(stderr);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Error: Invalid field type in model User');
      expect(errors[0]).toContain('Field name must be a valid identifier');
      expect(errors[0]).toContain('Location: schema.prisma:5:3');
    });

    it('should parse multiple error blocks', () => {
      const stderr = `
Error: Invalid field type in model User
  Field name must be a valid identifier

Error: Missing relation field in model Post
  Relation must have a field on both sides
      `.trim();

      const errors = parsePrismaErrors(stderr);

      expect(errors).toHaveLength(2);
      expect(errors[0]).toContain('Invalid field type in model User');
      expect(errors[1]).toContain('Missing relation field in model Post');
    });

    it('should handle lowercase "error" keyword', () => {
      const stderr = `
error: Schema validation failed
  Expected field type String
      `.trim();

      const errors = parsePrismaErrors(stderr);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('error: Schema validation failed');
    });

    it('should stop capturing context at empty line', () => {
      const stderr = `
Error: Invalid field type
  Context line 1
  Context line 2

This line should not be included
      `.trim();

      const errors = parsePrismaErrors(stderr);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('Context line 1');
      expect(errors[0]).toContain('Context line 2');
      expect(errors[0]).not.toContain('This line should not be included');
    });

    it('should stop capturing context at non-indented line', () => {
      const stderr = `
Error: Invalid field type
  Context line 1
  Context line 2
Non-indented line (new error)
  This should start a new block
      `.trim();

      const errors = parsePrismaErrors(stderr);

      expect(errors).toHaveLength(2);
      expect(errors[0]).toContain('Invalid field type');
      expect(errors[0]).toContain('Context line 2');
      expect(errors[0]).not.toContain('Non-indented');
    });

    it('should return full stderr as fallback if no structured errors found', () => {
      const stderr = 'Something went wrong but no structured error format';

      const errors = parsePrismaErrors(stderr);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toBe(stderr);
    });

    it('should handle empty stderr', () => {
      const stderr = '';

      const errors = parsePrismaErrors(stderr);

      expect(errors).toHaveLength(0);
    });

    it('should preserve the last error block', () => {
      const stderr = `
Error: First error
  Context for first

Error: Second error
  Context for second
  More context
      `.trim();

      const errors = parsePrismaErrors(stderr);

      expect(errors).toHaveLength(2);
      expect(errors[1]).toContain('Second error');
      expect(errors[1]).toContain('More context');
    });
  });
});
