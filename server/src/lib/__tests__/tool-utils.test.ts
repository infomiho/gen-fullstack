import { describe, expect, it } from 'vitest';
import { formatToolError, toToolInput, toToolResult } from '../tool-utils';

describe('tool-utils', () => {
  describe('toToolInput', () => {
    it('should convert object to Record<string, unknown>', () => {
      const input = { foo: 'bar', baz: 42 };
      expect(toToolInput(input)).toEqual(input);
    });

    it('should return empty object for non-object input', () => {
      expect(toToolInput('string')).toEqual({});
      expect(toToolInput(42)).toEqual({});
      expect(toToolInput(null)).toEqual({});
      expect(toToolInput(undefined)).toEqual({});
    });
  });

  describe('toToolResult', () => {
    it('should return string as-is', () => {
      expect(toToolResult('hello')).toBe('hello');
    });

    it('should stringify non-string values', () => {
      expect(toToolResult({ foo: 'bar' })).toBe('{"foo":"bar"}');
      expect(toToolResult(42)).toBe('42');
      expect(toToolResult(true)).toBe('true');
    });
  });

  describe('formatToolError', () => {
    it('should format error with message property', () => {
      const error = { message: 'File not found' };
      expect(formatToolError(error)).toBe('Error: File not found');
    });

    it('should format error as string', () => {
      const error = 'Command failed with exit code 1';
      expect(formatToolError(error)).toBe('Error: Command failed with exit code 1');
    });

    it('should avoid duplicate "Error:" prefix', () => {
      const error = { message: 'Error: File not found' };
      expect(formatToolError(error)).toBe('Error: File not found');
    });

    it('should avoid duplicate "Error:" prefix for string errors', () => {
      const error = 'Error: Command failed';
      expect(formatToolError(error)).toBe('Error: Command failed');
    });

    it('should handle null/undefined error', () => {
      expect(formatToolError(null)).toBe('Error: Unknown error occurred');
      expect(formatToolError(undefined)).toBe('Error: Unknown error occurred');
    });

    it('should handle Error object', () => {
      const error = new Error('Something went wrong');
      expect(formatToolError(error)).toBe('Error: Something went wrong');
    });

    it('should handle numeric error', () => {
      const error = 404;
      expect(formatToolError(error)).toBe('Error: 404');
    });

    it('should handle object without message property', () => {
      const error = { code: 'ENOENT', path: '/tmp/file.txt' };
      expect(formatToolError(error)).toBe('Error: [object Object]');
    });
  });
});
