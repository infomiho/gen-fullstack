import { z } from 'zod';
import { configLogger } from '../lib/logger.js';

const EnvSchema = z
  .object({
    // Server
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    CLIENT_URL: z.url().default('http://localhost:5173'),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

    // AI - At least one API key required
    OPENAI_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),

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
  })
  .refine((data) => data.OPENAI_API_KEY || data.ANTHROPIC_API_KEY, {
    message:
      'At least one API key is required: Set OPENAI_API_KEY (for GPT models) or ANTHROPIC_API_KEY (for Claude models)',
    path: ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY'],
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
    const env = EnvSchema.parse({
      // Server
      PORT: process.env.PORT,
      CLIENT_URL: process.env.CLIENT_URL,
      NODE_ENV: process.env.NODE_ENV,
      // AI
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
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

    // Warn at startup if only one provider is configured
    if (env.OPENAI_API_KEY && !env.ANTHROPIC_API_KEY) {
      configLogger.warn(
        '⚠️  Only OpenAI API key configured - Claude models (claude-haiku-4-5, claude-sonnet-4-5, claude-opus-4-1) will not be available',
      );
    } else if (env.ANTHROPIC_API_KEY && !env.OPENAI_API_KEY) {
      configLogger.warn(
        '⚠️  Only Anthropic API key configured - GPT models (gpt-5, gpt-5-mini, gpt-5-nano) will not be available',
      );
    } else {
      configLogger.info('✓ Both OpenAI and Anthropic API keys configured - all models available');
    }

    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      configLogger.error({ errors: error.issues }, '❌ Environment validation failed');
      error.issues.forEach((err) => {
        configLogger.error({ path: err.path.join('.'), message: err.message }, 'Validation error');
      });
      configLogger.error('Please check your .env file and ensure all required variables are set');
      process.exit(1);
    }
    throw error;
  }
}
