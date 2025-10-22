import { z } from 'zod';
import { configLogger } from '../lib/logger.js';

const EnvSchema = z.object({
  // Server
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // AI
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required for LLM functionality'),

  // Database
  DATABASE_URL: z.string().optional(),

  // Docker
  DOCKER_HOST: z.string().optional(),
  COLIMA_HOME: z.string().optional(),
  MAX_CONTAINERS: z.coerce.number().int().positive().default(20),

  // Generation
  STUCK_SESSION_THRESHOLD_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(5 * 60 * 1000), // 5 minutes
  GENERATION_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(30 * 60 * 1000), // 30 minutes

  // Logging (Note: LOG_LEVEL is used by logger.ts which can't import this due to circular deps)
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .optional()
    .default('info'),
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * Validated environment config singleton
 * Initialized once on first import, subsequent imports get the cached value
 */
let envCache: Env | null = null;

/**
 * Get validated environment config
 * Validates on first call, then returns cached value
 */
export function getEnv(): Env {
  if (envCache) {
    return envCache;
  }
  envCache = validateEnv();
  return envCache;
}

export function validateEnv(): Env {
  try {
    return EnvSchema.parse({
      // Server
      PORT: process.env.PORT,
      CLIENT_URL: process.env.CLIENT_URL,
      NODE_ENV: process.env.NODE_ENV,
      // AI
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      // Database
      DATABASE_URL: process.env.DATABASE_URL,
      // Docker
      DOCKER_HOST: process.env.DOCKER_HOST,
      COLIMA_HOME: process.env.COLIMA_HOME,
      MAX_CONTAINERS: process.env.MAX_CONTAINERS,
      // Generation
      STUCK_SESSION_THRESHOLD_MS: process.env.STUCK_SESSION_THRESHOLD_MS,
      GENERATION_TIMEOUT_MS: process.env.GENERATION_TIMEOUT_MS,
      // Logging
      LOG_LEVEL: process.env.LOG_LEVEL,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      configLogger.error({ errors: error.errors }, '❌ Environment validation failed');
      error.errors.forEach((err) => {
        configLogger.error({ path: err.path.join('.'), message: err.message }, 'Validation error');
      });
      configLogger.error('Please check your .env file and ensure all required variables are set');
      process.exit(1);
    }
    throw error;
  }
}
