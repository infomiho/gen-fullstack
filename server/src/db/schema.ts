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
 */
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  prompt: text('prompt').notNull(),
  strategy: text('strategy').notNull(),
  status: text('status').notNull(), // 'pending' | 'generating' | 'completed' | 'failed'
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
 * Timeline items table - stores all LLM messages, tool calls, and tool results
 */
export const timelineItems = sqliteTable('timeline_items', {
  id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
  sessionId: text('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  timestamp: integer('timestamp', { mode: 'timestamp_ms' }).notNull(),
  type: text('type').notNull(), // 'message' | 'tool_call' | 'tool_result'
  // Message fields (when type = 'message')
  messageId: text('message_id'), // Unique ID for LLM messages (for upserting streaming chunks)
  role: text('role'), // 'user' | 'assistant' | 'system'
  content: text('content'),
  // Tool call fields (when type = 'tool_call')
  toolCallId: text('tool_call_id'),
  toolName: text('tool_name'),
  toolArgs: text('tool_args'), // JSON string
  // Tool result fields (when type = 'tool_result')
  toolResultId: text('tool_result_id'),
  toolResultFor: text('tool_result_for'), // References toolCallId
  result: text('result'),
  isError: integer('is_error', { mode: 'boolean' }).default(false),
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
