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
  app_started: (data: { url: string; pid: number }) => void;
  app_log: (data: { type: 'stdout' | 'stderr'; message: string }) => void;
  compilation_error: (data: { errors: string[] }) => void;
  generation_complete: (metrics: GenerationMetrics) => void;
  error: (message: string) => void;
}

// ============================================================================
// WebSocket Events (Client → Server)
// ============================================================================

export interface ClientToServerEvents {
  start_generation: (payload: StartGenerationPayload) => void;
  stop_generation: () => void;
  restart_app: () => void;
  clear_workspace: () => void;
}
