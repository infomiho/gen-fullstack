import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parsePrismaErrors } from '../prisma-error-parser.js';

describe('Prisma Error Parser', () => {
  describe('parsePrismaErrors', () => {
    it('should parse error message with location and context', () => {
      const stderr = `
Error: Prisma schema validation - (validate wasm)
Error code: P1012
\x1b[1;91merror\x1b[0m: \x1b[1mError parsing attribute "@relation": A one-to-one relation must use unique fields on the defining side.\x1b[0m
  \x1b[1;94m-->\x1b[0m  \x1b[4mschema.prisma:18\x1b[0m
\x1b[1;94m   | \x1b[0m
\x1b[1;94m17 | \x1b[0m  userId Int
\x1b[1;94m18 | \x1b[0m  \x1b[1;91muser   User @relation(fields: [userId], references: [id])\x1b[0m
\x1b[1;94m19 | \x1b[0m}
\x1b[1;94m   | \x1b[0m

Validation Error Count: 1
      `.trim();

      const errors = parsePrismaErrors(stderr);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('Error parsing attribute "@relation"');
      expect(errors[0].line).toBe(18);
      expect(errors[0].location).toBe('schema.prisma:18');
      expect(errors[0].context).toHaveLength(3);
      expect(errors[0].context?.[0]).toContain('17 |');
      expect(errors[0].context?.[1]).toContain('18 |');
      expect(errors[0].message).not.toContain('\x1b['); // ANSI codes stripped
    });

    it('should parse multiple errors', () => {
      const stderr = `
Error: Prisma schema validation - (validate wasm)
Error code: P1012
error: Invalid field type in model User
  -->  schema.prisma:5
   |
 5 |   name InvalidType
   |

error: Missing required field in model Post
  -->  schema.prisma:12
   |
12 |   author User
   |

Validation Error Count: 2
      `.trim();

      const errors = parsePrismaErrors(stderr);

      expect(errors).toHaveLength(2);
      expect(errors[0].message).toContain('Invalid field type in model User');
      expect(errors[0].line).toBe(5);
      expect(errors[0].location).toBe('schema.prisma:5');
      expect(errors[1].message).toContain('Missing required field in model Post');
      expect(errors[1].line).toBe(12);
      expect(errors[1].location).toBe('schema.prisma:12');
    });

    it('should strip ANSI color codes', () => {
      const stderr = `
error: \x1b[1;91mError with colors\x1b[0m
  -->  schema.prisma:10
      `.trim();

      const errors = parsePrismaErrors(stderr);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('Error with colors');
      expect(errors[0].line).toBe(10);
      expect(errors[0].location).toBe('schema.prisma:10');
      expect(errors[0].message).not.toContain('\x1b[');
    });

    it('should handle errors without location', () => {
      const stderr = `
error: General schema error without specific location
      `.trim();

      const errors = parsePrismaErrors(stderr);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('General schema error without specific location');
      expect(errors[0].line).toBeUndefined();
      expect(errors[0].location).toBeUndefined();
    });

    it('should handle errors without context lines', () => {
      const stderr = `
error: Error with location but no context
  -->  schema.prisma:5
      `.trim();

      const errors = parsePrismaErrors(stderr);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('Error with location but no context');
      expect(errors[0].line).toBe(5);
      expect(errors[0].location).toBe('schema.prisma:5');
      expect(errors[0].context).toEqual([]);
    });

    it('should return cleaned stderr as fallback if no structured errors', () => {
      const stderr = '\x1b[1;91mSome unstructured error output\x1b[0m';

      const errors = parsePrismaErrors(stderr);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('Some unstructured error output');
      expect(errors[0].message).not.toContain('\x1b[');
      expect(errors[0].line).toBeUndefined();
      expect(errors[0].location).toBeUndefined();
    });

    it('should handle empty stderr', () => {
      const stderr = '';

      const errors = parsePrismaErrors(stderr);

      expect(errors).toHaveLength(0);
    });

    it('should parse real Prisma validation error', () => {
      // Real error output from Prisma CLI
      const stderr = `
Prisma schema loaded from schema.prisma

Error: Prisma schema validation - (validate wasm)
Error code: P1012
\x1b[1;91merror\x1b[0m: \x1b[1mError parsing attribute "@relation": A one-to-one relation must use unique fields on the defining side. Either add an \`@unique\` attribute to the field \`userId\`, or change the relation to one-to-many.\x1b[0m
  \x1b[1;94m-->\x1b[0m  \x1b[4mschema.prisma:18\x1b[0m
\x1b[1;94m   | \x1b[0m
\x1b[1;94m17 | \x1b[0m  userId Int
\x1b[1;94m18 | \x1b[0m  \x1b[1;91muser   User @relation(fields: [userId], references: [id])\x1b[0m
\x1b[1;94m19 | \x1b[0m}
\x1b[1;94m   | \x1b[0m

Validation Error Count: 1
[Context: validate]

Prisma CLI Version : 6.17.1
      `.trim();

      const errors = parsePrismaErrors(stderr);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('Error parsing attribute "@relation"');
      expect(errors[0].message).toContain('A one-to-one relation must use unique fields');
      expect(errors[0].line).toBe(18);
      expect(errors[0].location).toBe('schema.prisma:18');
      expect(errors[0].context).toBeDefined();
      expect(errors[0].context).toHaveLength(3);
      expect(errors[0].context?.[0]).toContain('17 |');
      expect(errors[0].context?.[1]).toContain('18 |');
      expect(errors[0].context?.[0]).toContain('userId Int');
      expect(errors[0].message).not.toContain('\x1b['); // No ANSI codes
      expect(errors[0].message).not.toContain('Error code: P1012'); // Header info excluded
      expect(errors[0].message).not.toContain('Validation Error Count'); // Footer info excluded
    });
  });

  describe('Real Prisma CLI output fixtures', () => {
    const fixturesDir = join(__dirname, 'fixtures', 'prisma-errors');

    it('should parse missing-relation error', () => {
      const output = readFileSync(join(fixturesDir, 'missing-relation.txt'), 'utf-8');
      const errors = parsePrismaErrors(output);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('missing an opposite relation field');
      expect(errors[0].line).toBe(14);
      expect(errors[0].location).toContain('missing-relation.prisma:14');
    });

    it('should parse ambiguous-relation error', () => {
      const output = readFileSync(join(fixturesDir, 'ambiguous-relation.txt'), 'utf-8');
      const errors = parsePrismaErrors(output);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('Ambiguous relation detected');
      expect(errors[0].message).toContain('writtenPosts');
      expect(errors[0].message).toContain('reviewedPosts');
      expect(errors[0].line).toBe(14);
    });

    it('should parse multiple invalid-field-type errors', () => {
      const output = readFileSync(join(fixturesDir, 'invalid-field-type.txt'), 'utf-8');
      const errors = parsePrismaErrors(output);

      // Should find exactly 2 distinct errors
      expect(errors).toHaveLength(2);

      // Should find InvalidType error
      expect(errors.some((e) => e.message.includes('InvalidType'))).toBe(true);
      expect(errors.some((e) => e.line === 14)).toBe(true);

      // Should find AnotherBad error
      expect(errors.some((e) => e.message.includes('AnotherBad'))).toBe(true);
      expect(errors.some((e) => e.line === 15)).toBe(true);
    });

    it('should parse multiple syntax errors', () => {
      const output = readFileSync(join(fixturesDir, 'syntax-error.txt'), 'utf-8');
      const errors = parsePrismaErrors(output);

      // Should find exactly 3 distinct errors
      expect(errors).toHaveLength(3);

      // Should find "not a valid field" error
      expect(errors.some((e) => e.message.includes('not a valid field'))).toBe(true);

      // Should find "already defined" error
      expect(errors.some((e) => e.message.includes('already defined'))).toBe(true);

      // Should find "at most one field" error
      expect(errors.some((e) => e.message.includes('At most one field'))).toBe(true);

      // All should have line numbers
      expect(errors.every((e) => e.line !== undefined)).toBe(true);
    });

    it('should parse missing-opposite-field error', () => {
      const output = readFileSync(join(fixturesDir, 'missing-opposite-field.txt'), 'utf-8');
      const errors = parsePrismaErrors(output);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('missing an opposite relation field');
      expect(errors[0].line).toBe(29);
    });

    it('should parse one-to-one-without-unique error', () => {
      const output = readFileSync(join(fixturesDir, 'one-to-one-without-unique.txt'), 'utf-8');
      const errors = parsePrismaErrors(output);

      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('one-to-one relation must use unique fields');
      expect(errors[0].message).toContain('@unique');
      expect(errors[0].line).toBe(21);
      expect(errors[0].context).toBeDefined();
      expect(errors[0].context?.length).toBeGreaterThan(0);
    });
  });
});
