import { describe, expect, it } from 'vitest';
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
      expect(errors[0]).toContain('Error parsing attribute "@relation"');
      expect(errors[0]).toContain('Location: schema.prisma:18');
      expect(errors[0]).toContain('17 |');
      expect(errors[0]).toContain('18 |');
      expect(errors[0]).not.toContain('\x1b['); // ANSI codes stripped
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
      expect(errors[0]).toContain('Invalid field type in model User');
      expect(errors[0]).toContain('Location: schema.prisma:5');
      expect(errors[1]).toContain('Missing required field in model Post');
      expect(errors[1]).toContain('Location: schema.prisma:12');
    });

    it('should strip ANSI color codes', () => {
      const stderr = `
error: \x1b[1;91mError with colors\x1b[0m
  -->  schema.prisma:10
      `.trim();

      const errors = parsePrismaErrors(stderr);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toBe('Error with colors\nLocation: schema.prisma:10');
      expect(errors[0]).not.toContain('\x1b[');
    });

    it('should handle errors without location', () => {
      const stderr = `
error: General schema error without specific location
      `.trim();

      const errors = parsePrismaErrors(stderr);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toBe('General schema error without specific location');
    });

    it('should handle errors without context lines', () => {
      const stderr = `
error: Error with location but no context
  -->  schema.prisma:5
      `.trim();

      const errors = parsePrismaErrors(stderr);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toBe('Error with location but no context\nLocation: schema.prisma:5');
    });

    it('should return cleaned stderr as fallback if no structured errors', () => {
      const stderr = '\x1b[1;91mSome unstructured error output\x1b[0m';

      const errors = parsePrismaErrors(stderr);

      expect(errors).toHaveLength(1);
      expect(errors[0]).toBe('Some unstructured error output');
      expect(errors[0]).not.toContain('\x1b[');
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
      expect(errors[0]).toContain('Error parsing attribute "@relation"');
      expect(errors[0]).toContain('A one-to-one relation must use unique fields');
      expect(errors[0]).toContain('Location: schema.prisma:18');
      expect(errors[0]).toContain('Code:');
      expect(errors[0]).toContain('17 |');
      expect(errors[0]).toContain('18 |');
      expect(errors[0]).toContain('userId Int');
      expect(errors[0]).not.toContain('\x1b['); // No ANSI codes
      expect(errors[0]).not.toContain('Error code: P1012'); // Header info excluded
      expect(errors[0]).not.toContain('Validation Error Count'); // Footer info excluded
    });
  });
});
