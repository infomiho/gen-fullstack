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
  serializers: {
    // Use 'error' key to match codebase convention (not 'err')
    // This ensures error objects are properly serialized in logs
    error: pino.stdSerializers.err,
  },
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
export const serverLogger = createLogger({ service: 'server' });
export const dockerLogger = createLogger({ service: 'docker' });
export const processLogger = createLogger({ service: 'process' });
export const strategyLogger = createLogger({ service: 'strategy' });
export const websocketLogger = createLogger({ service: 'websocket' });
export const databaseLogger = createLogger({ service: 'database' });
export const filesystemLogger = createLogger({ service: 'filesystem' });
export const commandLogger = createLogger({ service: 'command' });
export const routesLogger = createLogger({ service: 'routes' });
export const configLogger = createLogger({ service: 'config' });
