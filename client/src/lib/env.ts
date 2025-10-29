import { z } from 'zod';

/**
 * Environment variable schema
 *
 * Validates all environment variables at runtime using Zod.
 * This ensures type safety and provides helpful error messages
 * if required variables are missing or invalid.
 */
const envSchema = z.object({
  /**
   * API server URL
   * @default 'http://localhost:3001'
   */
  VITE_API_URL: z.string().url().default('http://localhost:3001'),
});

/**
 * Parsed and validated environment variables
 *
 * This object is the single source of truth for all environment variables.
 * Use `env.VITE_API_URL` instead of `import.meta.env.VITE_API_URL` directly.
 */
export const env = envSchema.parse({
  VITE_API_URL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
});

/**
 * Type-safe environment variables
 */
export type Env = z.infer<typeof envSchema>;
