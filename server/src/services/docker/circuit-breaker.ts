/**
 * Circuit Breaker
 *
 * Implements the circuit breaker pattern to prevent cascading failures
 * when Docker operations repeatedly fail.
 */

import { dockerLogger } from '../../lib/logger.js';
import { CIRCUIT_BREAKER_CONFIG } from './config.js';

/**
 * Circuit Breaker for Docker service
 *
 * Tracks consecutive failures and opens the circuit to prevent
 * overwhelming the Docker daemon with requests when it's unhealthy.
 */
export class CircuitBreaker {
  private consecutiveFailures = 0;
  private isOpen = false;
  private resetTimeout?: NodeJS.Timeout;

  /**
   * Check if circuit breaker is open and throw error if so
   */
  check(): void {
    if (this.isOpen) {
      throw new Error(
        'Docker service temporarily unavailable due to repeated failures. ' +
          'Please wait a moment and try again.',
      );
    }
  }

  /**
   * Record a successful Docker operation (reset failure counter)
   */
  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.isOpen = false;
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout);
      this.resetTimeout = undefined;
    }
  }

  /**
   * Record a failed Docker operation and open circuit breaker if threshold reached
   */
  recordFailure(): void {
    this.consecutiveFailures++;

    if (this.consecutiveFailures >= CIRCUIT_BREAKER_CONFIG.threshold) {
      this.isOpen = true;
      dockerLogger.error(
        {
          consecutiveFailures: this.consecutiveFailures,
          resetMs: CIRCUIT_BREAKER_CONFIG.resetMs,
        },
        'Circuit breaker opened',
      );

      // Auto-reset circuit breaker after timeout
      this.resetTimeout = setTimeout(() => {
        dockerLogger.info('Circuit breaker reset - attempting to recover');
        this.consecutiveFailures = 0;
        this.isOpen = false;
      }, CIRCUIT_BREAKER_CONFIG.resetMs);
    }
  }

  /**
   * Cleanup circuit breaker resources
   */
  cleanup(): void {
    if (this.resetTimeout) {
      clearTimeout(this.resetTimeout);
      this.resetTimeout = undefined;
    }
  }
}
