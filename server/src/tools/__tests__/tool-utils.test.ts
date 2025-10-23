/**
 * Tool Utils Tests
 *
 * Tests for tool utility functions, especially the runtime validation
 * of tool context to prevent cryptic errors.
 */

import { describe, expect, it } from 'vitest';
import { extractToolContext } from '../tool-utils.js';

describe('Tool Utils', () => {
  describe('extractToolContext', () => {
    it('should extract valid context with sessionId', () => {
      const context = {
        sessionId: 'test-session-123',
      };

      const result = extractToolContext(context);

      expect(result).toEqual({
        sessionId: 'test-session-123',
        io: undefined,
      });
    });

    it('should extract valid context with sessionId and io', () => {
      const mockIo = {
        to: (_room: string) => ({
          emit: (_event: string, _data: unknown) => {},
        }),
      };

      const context = {
        sessionId: 'test-session-123',
        io: mockIo,
      };

      const result = extractToolContext(context);

      expect(result.sessionId).toBe('test-session-123');
      expect(result.io).toBe(mockIo);
    });

    it('should throw error for null context', () => {
      expect(() => extractToolContext(null)).toThrow(
        'Invalid tool context: context is missing or not an object',
      );
    });

    it('should throw error for undefined context', () => {
      expect(() => extractToolContext(undefined)).toThrow(
        'Invalid tool context: context is missing or not an object',
      );
    });

    it('should throw error for non-object context', () => {
      expect(() => extractToolContext('not an object')).toThrow(
        'Invalid tool context: context is missing or not an object',
      );

      expect(() => extractToolContext(123)).toThrow(
        'Invalid tool context: context is missing or not an object',
      );

      expect(() => extractToolContext(true)).toThrow(
        'Invalid tool context: context is missing or not an object',
      );
    });

    it('should throw error for missing sessionId', () => {
      const context = {
        io: {},
      };

      expect(() => extractToolContext(context)).toThrow(
        'Invalid tool context: sessionId is missing or not a string',
      );
    });

    it('should throw error for non-string sessionId', () => {
      const context = {
        sessionId: 123,
      };

      expect(() => extractToolContext(context)).toThrow(
        'Invalid tool context: sessionId is missing or not a string',
      );
    });

    it('should throw error for empty sessionId', () => {
      const context = {
        sessionId: '',
      };

      expect(() => extractToolContext(context)).toThrow(
        'Invalid tool context: sessionId is missing or not a string',
      );
    });

    it('should throw error for invalid io type', () => {
      const context = {
        sessionId: 'test-session-123',
        io: 'not an object',
      };

      expect(() => extractToolContext(context)).toThrow(
        'Invalid tool context: io must be an object if provided',
      );
    });

    it('should provide helpful error messages', () => {
      try {
        extractToolContext({});
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('sessionId');
        expect((error as Error).message).toContain('Ensure experimental_context');
      }
    });

    it('should handle edge case with null sessionId', () => {
      const context = {
        sessionId: null,
      };

      expect(() => extractToolContext(context)).toThrow(
        'Invalid tool context: sessionId is missing or not a string',
      );
    });

    it('should allow io to be null (valid optional value)', () => {
      const context = {
        sessionId: 'test-session-123',
        io: null,
      };

      // null is typeof 'object', so this should pass validation
      const result = extractToolContext(context);
      expect(result.sessionId).toBe('test-session-123');
      expect(result.io).toBeNull();
    });
  });
});
