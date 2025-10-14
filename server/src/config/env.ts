import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z
    .string()
    .optional()
    .default('3001')
    .transform((val) => parseInt(val, 10))
    .refine((val) => !Number.isNaN(val) && val > 0 && val < 65536, {
      message: 'PORT must be a valid port number (1-65535)',
    }),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required for LLM functionality'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Env = z.infer<typeof EnvSchema>;

export function validateEnv(): Env {
  try {
    return EnvSchema.parse({
      PORT: process.env.PORT,
      CLIENT_URL: process.env.CLIENT_URL,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      NODE_ENV: process.env.NODE_ENV,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment validation failed:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      console.error('\nPlease check your .env file and ensure all required variables are set.');
      process.exit(1);
    }
    throw error;
  }
}
