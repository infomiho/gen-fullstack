import { describe, expect, it } from 'vitest';
import { formatTypeScriptErrorsForLLM, parseTypeScriptErrors } from '../typescript-error-parser.js';

describe('TypeScript Error Parser', () => {
  describe('parseTypeScriptErrors', () => {
    it('should parse TypeScript errors in format: file(line,col): error TSxxxx: message', () => {
      const output = `
src/index.ts(42,10): error TS2339: Property 'foo' does not exist on type 'Bar'.
src/utils.ts(15,5): error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.
      `.trim();

      const errors = parseTypeScriptErrors(output, 'server');

      expect(errors).toHaveLength(2);
      expect(errors[0]).toEqual({
        file: 'server/src/index.ts',
        line: 42,
        column: 10,
        code: 'TS2339',
        message: "Property 'foo' does not exist on type 'Bar'.",
      });
      expect(errors[1]).toEqual({
        file: 'server/src/utils.ts',
        line: 15,
        column: 5,
        code: 'TS2345',
        message: "Argument of type 'string' is not assignable to parameter of type 'number'.",
      });
    });

    it('should parse TypeScript errors in format: file:line:col - error TSxxxx: message', () => {
      const output = `
src/index.ts:42:10 - error TS2339: Property 'foo' does not exist on type 'Bar'.
src/utils.ts:15:5 - error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.
      `.trim();

      const errors = parseTypeScriptErrors(output, 'client');

      expect(errors).toHaveLength(2);
      expect(errors[0]).toEqual({
        file: 'client/src/index.ts',
        line: 42,
        column: 10,
        code: 'TS2339',
        message: "Property 'foo' does not exist on type 'Bar'.",
      });
      expect(errors[1]).toEqual({
        file: 'client/src/utils.ts',
        line: 15,
        column: 5,
        code: 'TS2345',
        message: "Argument of type 'string' is not assignable to parameter of type 'number'.",
      });
    });

    it('should handle mixed error formats in same output', () => {
      const output = `
src/index.ts(42,10): error TS2339: Property 'foo' does not exist on type 'Bar'.
src/utils.ts:15:5 - error TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.
      `.trim();

      const errors = parseTypeScriptErrors(output, 'server');

      expect(errors).toHaveLength(2);
      expect(errors[0].code).toBe('TS2339');
      expect(errors[1].code).toBe('TS2345');
    });

    it('should return empty array for output with no errors', () => {
      const output = 'No errors found';

      const errors = parseTypeScriptErrors(output, 'server');

      expect(errors).toHaveLength(0);
    });

    it('should handle multiline error messages correctly (not match across lines)', () => {
      const output = `
src/index.ts(42,10): error TS2339: Property 'foo' does not exist
on type 'Bar'.
src/utils.ts(15,5): error TS2345: Argument of type 'string'
is not assignable to parameter of type 'number'.
      `.trim();

      const errors = parseTypeScriptErrors(output, 'server');

      // Should capture first line of error message only (due to [^\n]+ pattern)
      expect(errors).toHaveLength(2);
      expect(errors[0].message).toBe("Property 'foo' does not exist");
      expect(errors[1].message).toBe("Argument of type 'string'");
    });

    it('should parse errors with complex file paths', () => {
      const output = `
deep/nested/dir/file.ts(10,5): error TS2322: Type 'number' is not assignable to type 'string'.
      `.trim();

      const errors = parseTypeScriptErrors(output, 'server');

      expect(errors).toHaveLength(1);
      expect(errors[0].file).toBe('server/deep/nested/dir/file.ts');
    });

    it('should handle multiple errors in same file', () => {
      const output = `
src/index.ts(10,5): error TS2322: Type 'number' is not assignable to type 'string'.
src/index.ts(20,10): error TS2339: Property 'bar' does not exist on type 'Foo'.
src/index.ts(30,15): error TS2345: Argument of type 'boolean' is not assignable to parameter of type 'number'.
      `.trim();

      const errors = parseTypeScriptErrors(output, 'server');

      expect(errors).toHaveLength(3);
      expect(errors.every((e) => e.file === 'server/src/index.ts')).toBe(true);
      expect(errors[0].line).toBe(10);
      expect(errors[1].line).toBe(20);
      expect(errors[2].line).toBe(30);
    });
  });

  describe('formatTypeScriptErrorsForLLM', () => {
    it('should format errors with file path, line, column, code, and message', () => {
      const errors = [
        {
          file: 'server/src/index.ts',
          line: 42,
          column: 10,
          code: 'TS2339',
          message: "Property 'foo' does not exist on type 'Bar'.",
        },
        {
          file: 'client/src/App.tsx',
          line: 15,
          column: 5,
          code: 'TS2345',
          message: "Argument of type 'string' is not assignable to parameter of type 'number'.",
        },
      ];

      const formatted = formatTypeScriptErrorsForLLM(errors);

      expect(formatted).toContain('TypeScript found 2 type errors');
      expect(formatted).toContain('1. server/src/index.ts:42:10 - TS2339');
      expect(formatted).toContain("Property 'foo' does not exist");
      expect(formatted).toContain('2. client/src/App.tsx:15:5 - TS2345');
      expect(formatted).toContain('Fix these errors by updating the relevant files');
    });

    it('should use singular form for single error', () => {
      const errors = [
        {
          file: 'server/src/index.ts',
          line: 42,
          column: 10,
          code: 'TS2339',
          message: "Property 'foo' does not exist on type 'Bar'.",
        },
      ];

      const formatted = formatTypeScriptErrorsForLLM(errors);

      expect(formatted).toContain('1 type error:');
      expect(formatted).not.toContain('errors:');
    });

    it('should truncate to 10 errors max and show count of remaining', () => {
      const errors = Array.from({ length: 15 }, (_, i) => ({
        file: `file${i}.ts`,
        line: i + 1,
        column: 1,
        code: 'TS2339',
        message: `Error ${i + 1}`,
      }));

      const formatted = formatTypeScriptErrorsForLLM(errors);

      expect(formatted).toContain('15 type errors');
      expect(formatted).toContain('10. file9.ts:10:1');
      expect(formatted).not.toContain('11. file10.ts');
      expect(formatted).toContain('... and 5 more errors');
    });
  });
});
