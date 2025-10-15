/**
 * Drizzle Kit Configuration
 *
 * Configuration for Drizzle Kit CLI tool for migrations and introspection.
 */

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL || './data/gen-fullstack.db',
  },
});
