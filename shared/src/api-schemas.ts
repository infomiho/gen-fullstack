/**
 * API Schemas for oRPC
 *
 * Zod schemas for type-safe API contracts between client and server.
 * These schemas are auto-generated from Drizzle ORM definitions using drizzle-zod.
 * This ensures a single source of truth for data types.
 */

import { createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// Import Drizzle table definitions from db package
import { files, sessions, timelineItems } from '@gen-fullstack/db';

/**
 * Base Schemas - Auto-generated from Drizzle ORM with refinements
 * These match the database types exactly, preventing type drift
 */
export const SessionSchema = createSelectSchema(sessions, {
  status: (schema) =>
    schema as z.ZodType<'pending' | 'generating' | 'completed' | 'failed' | 'cancelled'>,
});

export const TimelineItemSchema = createSelectSchema(timelineItems, {
  type: (schema) => schema as z.ZodType<'message' | 'tool_call' | 'tool_result' | 'pipeline_stage'>,
});

export const FileSchema = createSelectSchema(files);

/**
 * Input Schemas
 */

export const GetSessionInputSchema = z.object({
  sessionId: z.string(),
});

export const DeleteSessionInputSchema = z.object({
  sessionId: z.string(),
});

export const GetReplayDataInputSchema = z.object({
  sessionId: z.string(),
});

/**
 * Output Schemas
 */

export const ListSessionsOutputSchema = z.object({
  sessions: z.array(SessionSchema),
});

export const GetSessionOutputSchema = z.object({
  session: SessionSchema,
  timeline: z.array(TimelineItemSchema),
  files: z.array(FileSchema),
});

export const DeleteSessionOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

/**
 * Replay Data Schemas
 */

export const ReplayTimelineItemSchema = z.object({
  id: z.string(),
  type: z.string(),
  timestamp: z.number(), // Unix timestamp in milliseconds
  data: z.record(z.string(), z.unknown()),
});

export const ReplayFileSchema = z.object({
  path: z.string(),
  timestamp: z.number(), // Unix timestamp in milliseconds
  content: z.string(),
});

export const GetReplayDataOutputSchema = z.object({
  sessionStartTime: z.number(), // Unix timestamp in milliseconds
  duration: z.number(), // Duration in milliseconds
  timelineItems: z.array(ReplayTimelineItemSchema),
  files: z.array(ReplayFileSchema),
});

/**
 * Type exports for convenience
 *
 * Note: These are kept for backward compatibility, but consumers can also
 * use z.infer<typeof Schema> directly or oRPC's InferRouterOutputs utility.
 */
export type ListSessionsOutput = z.infer<typeof ListSessionsOutputSchema>;
export type GetSessionOutput = z.infer<typeof GetSessionOutputSchema>;
export type DeleteSessionOutput = z.infer<typeof DeleteSessionOutputSchema>;
export type GetReplayDataOutput = z.infer<typeof GetReplayDataOutputSchema>;
export type ReplayTimelineItem = z.infer<typeof ReplayTimelineItemSchema>;
export type ReplayFile = z.infer<typeof ReplayFileSchema>;
