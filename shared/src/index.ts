import { z } from 'zod';
import { MAX_FILE_SIZE } from './constants.js';

/**
 * Shared types and schemas for Gen Fullstack
 *
 * This package contains all types shared between client and server to ensure
 * type safety and prevent mismatches.
 */

// Re-export constants
export * from './constants.js';

// ============================================================================
// WebSocket Event Schemas
// ============================================================================

export const StartGenerationSchema = z.object({
  prompt: z.string().min(1),
  strategy: z.enum(['naive', 'plan-first', 'template', 'compiler-check', 'building-blocks']),
});

export type StartGenerationPayload = z.infer<typeof StartGenerationSchema>;

export const AppActionSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID format'),
});

export type AppActionPayload = z.infer<typeof AppActionSchema>;

export const SaveFileSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID format'),
  path: z
    .string()
    .min(1, 'Path cannot be empty')
    .max(500, 'Path too long')
    .regex(/^[a-zA-Z0-9._/-]+$/, 'Path contains invalid characters'),
  content: z
    .string()
    .max(MAX_FILE_SIZE, `File content too large (max ${MAX_FILE_SIZE / 1_000_000}MB)`),
});

export type SaveFilePayload = z.infer<typeof SaveFileSchema>;

export const SubscribeSessionSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID format'),
});

export type SubscribeSessionPayload = z.infer<typeof SubscribeSessionSchema>;

// ============================================================================
// LLM Message Types
// ============================================================================

export interface LLMMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number; // Unix timestamp in milliseconds
}

export interface ToolCall {
  id: string;
  name: string;
  // Args may be undefined during initial emission before input is fully captured
  args?: Record<string, unknown>;
  timestamp: number; // Unix timestamp in milliseconds
}

export interface ToolResult {
  id: string;
  toolName: string;
  result: string;
  timestamp: number; // Unix timestamp in milliseconds
}

export interface FileUpdate {
  path: string;
  content: string;
}

// ============================================================================
// App Execution Types
// ============================================================================

export type AppStatus =
  | 'idle'
  | 'creating'
  | 'installing'
  | 'starting'
  | 'running'
  | 'failed'
  | 'stopped';

export interface AppInfo {
  sessionId: string;
  status: AppStatus;
  port?: number;
  url?: string;
  error?: string;
  containerId?: string;
}

export interface AppLog {
  sessionId: string;
  timestamp: number;
  type: 'stdout' | 'stderr';
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface BuildEvent {
  sessionId: string;
  timestamp: number;
  event: 'start' | 'success' | 'error';
  details?: string;
}

// ============================================================================
// Generation Metrics
// ============================================================================

export interface GenerationMetrics {
  strategy?: string;
  model?: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  duration: number;
  steps: number;
}

// ============================================================================
// WebSocket Events (Server → Client)
// ============================================================================

export interface ServerToClientEvents {
  // Generation events
  session_started: (data: { sessionId: string }) => void;
  llm_message: (message: LLMMessage) => void;
  tool_call: (toolCall: ToolCall) => void;
  tool_result: (result: ToolResult) => void;
  file_updated: (data: FileUpdate) => void;
  generation_complete: (metrics: GenerationMetrics) => void;

  // App execution events
  app_status: (data: AppInfo) => void;
  app_log: (log: AppLog) => void;
  build_event: (event: BuildEvent) => void;

  // Error events
  error: (message: string) => void;
}

// ============================================================================
// WebSocket Events (Client → Server)
// ============================================================================

export interface ClientToServerEvents {
  start_generation: (payload: StartGenerationPayload) => void;
  stop_generation: () => void;
  clear_workspace: () => void;
  subscribe_to_session: (data: { sessionId: string }) => void;

  // App execution commands
  start_app: (data: { sessionId: string }) => void;
  stop_app: (data: { sessionId: string }) => void;
  restart_app: (data: { sessionId: string }) => void;
  get_app_status: (data: { sessionId: string }) => void;

  // File editing commands
  save_file: (data: { sessionId: string; path: string; content: string }) => void;
}
