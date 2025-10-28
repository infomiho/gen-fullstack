/**
 * Database Schema
 *
 * Drizzle ORM schema definitions for session persistence.
 * Uses SQLite with better-sqlite3 driver.
 */

import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Sessions table - stores generation session metadata
 *
 * Note: TypeScript enums provide compile-time safety. Runtime validation
 * is enforced by Zod schemas in the WebSocket layer.
 *
 * Migration tracking is handled automatically by Drizzle ORM via the
 * __drizzle_migrations table (no need to define it in schema).
 */
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  prompt: text('prompt').notNull(),
  // NEW: Store assembled prompts for debugging (nullable for backward compatibility)
  systemPrompt: text('system_prompt'),
  fullUserPrompt: text('full_user_prompt'),
  // Capability-based configuration (JSON) - describes which capabilities to run
  capabilityConfig: text('capability_config').notNull(),
  // Status must be one of: 'pending', 'generating', 'completed', 'failed', 'cancelled'
  status: text('status')
    .$type<'pending' | 'generating' | 'completed' | 'failed' | 'cancelled'>()
    .notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }),
  completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
  errorMessage: text('error_message'),
  // Generation metrics
  inputTokens: integer('input_tokens').default(0),
  outputTokens: integer('output_tokens').default(0),
  totalTokens: integer('total_tokens').default(0),
  cost: text('cost').default('0'), // Store as string to preserve precision
  durationMs: integer('duration_ms').default(0),
  stepCount: integer('step_count').default(0),
});

/**
 * Timeline items table - stores all LLM messages, tool calls, tool results, and pipeline stages
 */
export const timelineItems = sqliteTable('timeline_items', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  sessionId: text('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  timestamp: integer('timestamp', { mode: 'timestamp_ms' }).notNull(),
  type: text('type').notNull(), // 'message' | 'tool_call' | 'tool_result' | 'pipeline_stage'
  // Message fields (when type = 'message')
  messageId: text('message_id'), // Unique ID for LLM messages (for upserting streaming chunks)
  role: text('role'), // 'user' | 'assistant' | 'system'
  content: text('content'),
  // Tool call fields (when type = 'tool_call')
  toolCallId: text('tool_call_id'),
  toolName: text('tool_name'),
  toolArgs: text('tool_args'), // JSON string
  toolReason: text('tool_reason'), // Brief explanation of why this tool was called
  // Tool result fields (when type = 'tool_result')
  toolResultId: text('tool_result_id'),
  toolResultFor: text('tool_result_for'), // References toolCallId
  result: text('result'),
  isError: integer('is_error', { mode: 'boolean' }).default(false),
  // Pipeline stage fields (when type = 'pipeline_stage')
  stageId: text('stage_id'), // Unique ID for this stage (stable across status updates)
  stageType: text('stage_type'), // 'planning' | 'validation' | 'template_loading' | 'completing'
  stageStatus: text('stage_status'), // 'started' | 'completed' | 'failed'
  stageData: text('stage_data'), // JSON string with plan/errors/iteration/etc
});

/**
 * Files table - stores generated file metadata and content
 */
export const files = sqliteTable('files', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  sessionId: text('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  path: text('path').notNull(),
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

/**
 * Type exports for use in application code
 */
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type TimelineItem = typeof timelineItems.$inferSelect;
export type NewTimelineItem = typeof timelineItems.$inferInsert;
export type File = typeof files.$inferSelect;
export type NewFile = typeof files.$inferInsert;
