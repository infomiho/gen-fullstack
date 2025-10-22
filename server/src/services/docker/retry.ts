/**
 * Docker Retry Utility
 *
 * Provides retry logic with exponential backoff for Docker operations
 * that may fail with 409 conflicts (container already in use, etc.).
 */

import { dockerLogger } from '../../lib/logger.js';
import { RETRY_CONFIG } from './config.js';

/**
 * Retry helper for Docker operations that may fail with 409 conflicts
 *
 * @param operation - Async function to execute with retry logic
 * @param operationName - Human-readable name for logging
 * @returns Promise resolving to operation result
 * @throws Error if all retry attempts fail
 */
export async function retryOnConflict<T>(
  operation: () => Promise<T>,
  operationName: string,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      const is409 =
        error &&
        typeof error === 'object' &&
        'statusCode' in error &&
        (error as { statusCode: number }).statusCode === 409;

      if (!is409 || attempt === RETRY_CONFIG.maxAttempts) {
        throw error;
      }

      const delay = RETRY_CONFIG.delayMs * RETRY_CONFIG.backoffMultiplier ** (attempt - 1);
      dockerLogger.info(
        { operationName, delay, attempt, maxAttempts: RETRY_CONFIG.maxAttempts },
        `${operationName} failed with 409 conflict, retrying`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw (
    lastError || new Error(`${operationName} failed after ${RETRY_CONFIG.maxAttempts} attempts`)
  );
}
