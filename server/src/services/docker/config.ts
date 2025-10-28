/**
 * Docker Service Configuration
 *
 * Centralized configuration for Docker container management,
 * including resource limits, timeouts, and operational parameters.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const RUNNER_IMAGE = 'gen-fullstack-runner';
export const DOCKERFILE_PATH = path.join(__dirname, '../../../docker/runner.Dockerfile');

/**
 * Resource limits for Docker containers
 */
export const RESOURCE_LIMITS = {
  memory: 512 * 1024 * 1024, // 512MB RAM
  nanoCPUs: 1000000000, // 1 CPU core
  diskQuota: 100 * 1024 * 1024, // 100MB disk (not enforced on all systems)
} as const;

/**
 * Port range for host port mapping
 */
export const PORT_RANGE = {
  min: 5001,
  max: 5200,
} as const;

/**
 * Timeout configuration (in milliseconds)
 */
export const TIMEOUTS = {
  install: 5 * 60 * 1000, // 5 minutes for npm install (increased from 2 min to handle slow networks)
  start: 30 * 1000, // 30 seconds to start dev server
  stop: 10 * 1000, // 10 seconds for graceful shutdown
  maxRuntime: 10 * 60 * 1000, // 10 minutes max runtime
  default: 60 * 1000, // 1 minute default timeout for operations
  prismaGenerate: 60 * 1000, // 1 minute for Prisma client generation
  prismaMigrate: 60 * 1000, // 1 minute for Prisma migrations
  containerCreation: 2 * 60 * 1000, // 2 minutes for image build + container creation
  viteHttpReady: 60 * 1000, // 1 minute for Vite + HTTP ready check
} as const;

/**
 * Retry configuration for Docker 409 conflicts
 */
export const RETRY_CONFIG = {
  maxAttempts: 3,
  delayMs: 1000, // Start with 1 second
  backoffMultiplier: 2, // Exponential backoff
} as const;

/**
 * HTTP readiness check configuration
 */
export const HTTP_READY_CHECK = {
  maxAttempts: 10, // ~5 seconds total with 500ms delays
  delayMs: 500, // Wait between retry attempts
  requestTimeoutMs: 1000, // Timeout for each HTTP request
} as const;

/**
 * Circuit breaker configuration
 */
export const CIRCUIT_BREAKER_CONFIG = {
  threshold: 5, // Open after 5 consecutive failures
  resetMs: 60 * 1000, // Try again after 1 minute
} as const;

/**
 * Log retention configuration
 */
export const LOG_RETENTION = {
  maxLogs: 1000, // Maximum logs to keep in memory
  pruneThreshold: 1200, // Prune when logs exceed this count
} as const;

/**
 * NPM commands
 */
export const NPM_COMMANDS = {
  install: {
    cmd: ['npm', 'install', '--loglevel=warn'] as const,
    display: 'npm install --loglevel=warn',
  },
} as const;
