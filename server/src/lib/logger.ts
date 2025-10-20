/**
 * Logger Module
 *
 * Centralized structured logging using Pino.
 * Provides type-safe, performant logging with context support.
 */

import pino from 'pino';

/**
 * Create the root logger instance
 *
 * Configuration:
 * - Level: Controlled by LOG_LEVEL env var (default: info)
 * - Pretty printing: Enabled in development for readability
 * - Production: JSON output for log aggregation systems
 */
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(process.env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss.l',
        ignore: 'pid,hostname',
        singleLine: false,
      },
    },
  }),
});

/**
 * Create a child logger with additional context
 *
 * @example
 * const dockerLogger = createLogger({ service: 'docker' });
 * dockerLogger.info({ sessionId, containerId }, 'Container created');
 */
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

/**
 * Export the root logger for direct use
 */
export { logger };

/**
 * Logger instances for different services
 */
export const dockerLogger = createLogger({ service: 'docker' });
export const processLogger = createLogger({ service: 'process' });
export const strategyLogger = createLogger({ service: 'strategy' });
export const websocketLogger = createLogger({ service: 'websocket' });
export const databaseLogger = createLogger({ service: 'database' });
