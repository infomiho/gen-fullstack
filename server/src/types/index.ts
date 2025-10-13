import { z } from 'zod';

// WebSocket Events
export const StartGenerationSchema = z.object({
  prompt: z.string().min(1),
  strategy: z.enum(['naive', 'plan-first', 'template', 'compiler-check', 'building-blocks']),
});

export type StartGenerationPayload = z.infer<typeof StartGenerationSchema>;

// LLM Message types
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolResult {
  id: string;
  result: string;
}

// Server to Client events
export interface ServerToClientEvents {
  llm_message: (message: LLMMessage) => void;
  tool_call: (toolCall: ToolCall) => void;
  tool_result: (result: ToolResult) => void;
  file_updated: (data: { path: string; content: string }) => void;
  app_started: (data: { url: string; pid: number }) => void;
  app_log: (data: { type: 'stdout' | 'stderr'; message: string }) => void;
  compilation_error: (data: { errors: string[] }) => void;
  generation_complete: (data: {
    success: boolean;
    tokensUsed?: number;
    timeElapsed?: number;
    iterations?: number;
  }) => void;
  error: (message: string) => void;
}

// Client to Server events
export interface ClientToServerEvents {
  start_generation: (payload: StartGenerationPayload) => void;
  stop_generation: () => void;
  restart_app: () => void;
  clear_workspace: () => void;
}
