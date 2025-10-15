import { z } from 'zod';

/**
 * Shared types and schemas for Gen Fullstack
 *
 * This package contains all types shared between client and server to ensure
 * type safety and prevent mismatches.
 */

// ============================================================================
// WebSocket Event Schemas
// ============================================================================

export const StartGenerationSchema = z.object({
  prompt: z.string().min(1),
  strategy: z.enum(['naive', 'plan-first', 'template', 'compiler-check', 'building-blocks']),
});

export type StartGenerationPayload = z.infer<typeof StartGenerationSchema>;

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

  // App execution commands
  start_app: (data: { sessionId: string }) => void;
  stop_app: (data: { sessionId: string }) => void;
  restart_app: (data: { sessionId: string }) => void;
}
