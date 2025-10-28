/**
 * HTTP Ready Check
 *
 * Polls HTTP endpoints to verify server readiness before allowing access.
 * Prevents "Unable to connect" errors in the preview iframe.
 */

import { dockerLogger } from '../../lib/logger.js';
import { HTTP_READY_CHECK } from './config.js';

/**
 * Attempt a single HTTP readiness check
 *
 * @param port - Host port to check
 * @param serviceName - Service name (client or server) for logging
 * @param attempt - Attempt number (0-based)
 * @param signal - Optional AbortSignal to cancel the check
 * @returns True if server responds, false otherwise
 */
async function attemptHttpCheck(
  port: number,
  serviceName: string,
  attempt: number,
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    await fetch(`http://localhost:${port}`, {
      method: 'HEAD',
      signal: signal || AbortSignal.timeout(HTTP_READY_CHECK.requestTimeoutMs),
    });
    return true; // Any response means server is listening
  } catch (error) {
    // Log first and last failures for debugging
    const shouldLog = attempt === 0 || attempt === HTTP_READY_CHECK.maxAttempts - 1;
    if (shouldLog) {
      dockerLogger.info(
        {
          port,
          serviceName,
          attempt: attempt + 1,
          maxAttempts: HTTP_READY_CHECK.maxAttempts,
          error: error instanceof Error ? error.message : error,
        },
        `HTTP ready check attempt failed for ${serviceName}`,
      );
    }
    return false;
  }
}

/**
 * Check if HTTP server is actually ready to accept connections
 *
 * Polls the HTTP endpoint with HEAD requests until the server responds.
 * This prevents the iframe from loading before the server is ready to
 * handle requests, avoiding "Unable to connect" errors.
 *
 * @param port - The host port to check
 * @param serviceName - Service name (client or server) for logging
 * @param signal - Optional AbortSignal to cancel the check
 * @returns Promise<boolean> - true if server responds within timeout, false otherwise
 *
 * @remarks
 * - Uses HEAD requests to minimize overhead
 * - Accepts any HTTP response (including 404) as "ready"
 * - Retries up to 10 times with 500ms delays (~5 seconds total)
 * - Each request has a 1 second timeout
 * - Logs first and last failures for debugging
 * - Can be canceled via AbortSignal
 */
export async function checkHttpReady(
  port: number,
  serviceName: string,
  signal?: AbortSignal,
): Promise<boolean> {
  for (let i = 0; i < HTTP_READY_CHECK.maxAttempts; i++) {
    if (signal?.aborted) {
      return false;
    }

    const isReady = await attemptHttpCheck(port, serviceName, i, signal);
    if (isReady) {
      dockerLogger.info({ port, serviceName }, `${serviceName} is ready and responding`);
      return true;
    }

    if (signal?.aborted) {
      return false;
    }

    // Wait before next attempt (unless last attempt)
    const isLastAttempt = i === HTTP_READY_CHECK.maxAttempts - 1;
    if (!isLastAttempt) {
      await new Promise((resolve) => setTimeout(resolve, HTTP_READY_CHECK.delayMs));
    }
  }

  dockerLogger.error(
    { port, serviceName },
    `${serviceName} failed to become ready after ${HTTP_READY_CHECK.maxAttempts} attempts`,
  );
  return false;
}
