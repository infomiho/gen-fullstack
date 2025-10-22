/**
 * Retry Utilities
 *
 * Generic retry logic for operations that may fail transiently.
 */

import { createLogger } from './logger.js';

const logger = createLogger({ service: 'retry-utils' });

export interface RetryOptions {
  /**
   * Maximum number of retry attempts (not including the first attempt)
   * @default 1
   */
  maxRetries?: number;

  /**
   * Function to determine if an error should trigger a retry
   * @param error - The error from the failed operation
   * @returns true if should retry, false otherwise
   */
  shouldRetry: (error: Error | unknown) => boolean;

  /**
   * Optional callback called before each retry attempt
   * @param attemptNumber - The retry attempt number (1-based)
   * @param error - The error from the previous attempt
   */
  onRetry?: (attemptNumber: number, error: Error | unknown) => void | Promise<void>;

  /**
   * Optional delay in milliseconds before retrying
   * @default 0
   */
  delayMs?: number;
}

/**
 * Handle retry logic: callbacks and delays
 */
async function handleRetry(
  attempt: number,
  error: Error | unknown,
  options: Pick<RetryOptions, 'onRetry' | 'delayMs' | 'maxRetries'>,
): Promise<void> {
  const { onRetry, delayMs = 0, maxRetries = 1 } = options;

  if (onRetry) {
    await onRetry(attempt, error);
  }

  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  logger.debug(
    { attempt, maxRetries, error: error instanceof Error ? error.message : String(error) },
    'Retrying operation',
  );
}

/**
 * Retry an async operation with configurable retry logic
 *
 * @param operation - The async operation to retry
 * @param options - Retry configuration
 * @returns The result of the successful operation
 * @throws The last error if all retries are exhausted
 *
 * @example
 * ```typescript
 * const result = await retryOperation(
 *   () => installDependencies(sessionId),
 *   {
 *     maxRetries: 1,
 *     shouldRetry: (error) =>
 *       error instanceof Error && error.message.includes('timeout after'),
 *     onRetry: (attempt, error) => {
 *       logger.info(`Retrying after timeout (attempt ${attempt}/1)`);
 *     },
 *   }
 * );
 * ```
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const { maxRetries = 1, shouldRetry } = options;

  let lastError: Error | unknown;
  const totalAttempts = 1 + maxRetries;

  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      const isLastAttempt = attempt === totalAttempts;
      if (isLastAttempt || !shouldRetry(error)) {
        throw error;
      }

      await handleRetry(attempt, error, options);
    }
  }

  throw lastError;
}

/**
 * Helper to check if an error is an execution timeout (not a network timeout)
 *
 * Execution timeouts include "timeout after X ms" in the error message.
 * Network timeouts (ETIMEDOUT) are a different type of error.
 *
 * @param error - The error to check
 * @returns true if the error is an execution timeout
 */
export function isExecutionTimeout(error: Error | unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes('timeout after');
  }
  if (typeof error === 'object' && error !== null && 'stderr' in error) {
    return String((error as { stderr?: string }).stderr || '').includes('timeout after');
  }
  return false;
}
