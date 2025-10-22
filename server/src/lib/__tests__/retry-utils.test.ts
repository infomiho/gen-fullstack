/**
 * Retry Utilities Tests
 *
 * Tests for the generic retry logic helper functions.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isExecutionTimeout, retryOperation } from '../retry-utils.js';

describe('Retry Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('retryOperation', () => {
    it('should return result on first success', async () => {
      const operation = vi.fn().mockResolvedValue('success');

      const result = await retryOperation(operation, {
        shouldRetry: () => true,
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry once on failure and succeed', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('timeout after 5000ms'))
        .mockResolvedValueOnce('success');

      const onRetry = vi.fn();

      const result = await retryOperation(operation, {
        maxRetries: 1,
        shouldRetry: (error) => error instanceof Error && error.message.includes('timeout after'),
        onRetry,
      });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
    });

    it('should fail after all retries exhausted', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('timeout after 5000ms'));

      const onRetry = vi.fn();

      await expect(
        retryOperation(operation, {
          maxRetries: 2,
          shouldRetry: (error) => error instanceof Error && error.message.includes('timeout after'),
          onRetry,
        }),
      ).rejects.toThrow('timeout after 5000ms');

      expect(operation).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
      expect(onRetry).toHaveBeenCalledTimes(2);
    });

    it('should not retry if shouldRetry returns false', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('network error ETIMEDOUT'));

      await expect(
        retryOperation(operation, {
          maxRetries: 1,
          shouldRetry: (error) => error instanceof Error && error.message.includes('timeout after'),
        }),
      ).rejects.toThrow('network error ETIMEDOUT');

      expect(operation).toHaveBeenCalledTimes(1); // No retry
    });

    it('should delay between retries when delayMs is specified', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('timeout after 5000ms'))
        .mockResolvedValueOnce('success');

      const start = Date.now();

      const result = await retryOperation(operation, {
        maxRetries: 1,
        shouldRetry: () => true,
        delayMs: 100,
      });

      const elapsed = Date.now() - start;

      expect(result).toBe('success');
      expect(elapsed).toBeGreaterThanOrEqual(100);
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should work with async onRetry callback', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('timeout after 5000ms'))
        .mockResolvedValueOnce('success');

      const onRetry = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      const start = Date.now();

      await retryOperation(operation, {
        maxRetries: 1,
        shouldRetry: () => true,
        onRetry,
      });

      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(50);
      expect(onRetry).toHaveBeenCalledOnce();
    });

    it('should handle multiple retries with correct attempt numbers', async () => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error('timeout 1'))
        .mockRejectedValueOnce(new Error('timeout 2'))
        .mockResolvedValueOnce('success');

      const onRetry = vi.fn();

      await retryOperation(operation, {
        maxRetries: 2,
        shouldRetry: () => true,
        onRetry,
      });

      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenNthCalledWith(1, 1, expect.any(Error));
      expect(onRetry).toHaveBeenNthCalledWith(2, 2, expect.any(Error));
    });
  });

  describe('isExecutionTimeout', () => {
    it('should return true for execution timeout in Error message', () => {
      const error = new Error('command: npm install timeout after 300000ms');
      expect(isExecutionTimeout(error)).toBe(true);
    });

    it('should return true for execution timeout in stderr object', () => {
      const error = {
        success: false,
        stderr: 'npm install timeout after 120000ms',
        stdout: '',
      };
      expect(isExecutionTimeout(error)).toBe(true);
    });

    it('should return false for network timeout (ETIMEDOUT)', () => {
      const error = new Error('npm ERR! network request failed, reason: connect ETIMEDOUT');
      expect(isExecutionTimeout(error)).toBe(false);
    });

    it('should return false for other errors', () => {
      const error = new Error('npm ERR! code ENOTFOUND');
      expect(isExecutionTimeout(error)).toBe(false);
    });

    it('should return false for non-error objects', () => {
      expect(isExecutionTimeout('string error')).toBe(false);
      expect(isExecutionTimeout(null)).toBe(false);
      expect(isExecutionTimeout(undefined)).toBe(false);
      expect(isExecutionTimeout(123)).toBe(false);
    });

    it('should return false for empty stderr', () => {
      const error = {
        success: false,
        stderr: '',
        stdout: '',
      };
      expect(isExecutionTimeout(error)).toBe(false);
    });
  });
});
