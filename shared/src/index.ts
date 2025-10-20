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
// Strategy Types
// ============================================================================

export const STRATEGY_TYPES = [
  'naive',
  'plan-first',
  'template',
  'compiler-check',
  'building-blocks',
] as const;
export type StrategyType = (typeof STRATEGY_TYPES)[number];

export interface StrategyMetadata {
  value: StrategyType;
  label: string;
  description: string;
  implemented: boolean;
}

export const STRATEGIES: readonly StrategyMetadata[] = [
  {
    value: 'naive',
    label: 'Naive Approach',
    description: 'Direct prompt to code',
    implemented: true,
  },
  {
    value: 'plan-first',
    label: 'Plan First',
    description: 'Generate high-level plan before coding',
    implemented: true,
  },
  {
    value: 'template',
    label: 'With Template',
    description: 'Start with pre-built template',
    implemented: true,
  },
  {
    value: 'compiler-check',
    label: 'Compiler Checks',
    description: 'Self-correct with TypeScript errors',
    implemented: true,
  },
  {
    value: 'building-blocks',
    label: 'Building Blocks',
    description: 'Use higher-level components',
    implemented: false,
  },
] as const;

/**
 * Get only implemented strategies for UI and validation
 */
export const IMPLEMENTED_STRATEGIES = STRATEGIES.filter((s) => s.implemented);

/**
 * Type-safe type for implemented strategies only
 */
export type ImplementedStrategyType = (typeof IMPLEMENTED_STRATEGIES)[number]['value'];

// ============================================================================
// WebSocket Event Schemas
// ============================================================================

export const StartGenerationSchema = z.object({
  prompt: z.string().min(1),
  strategy: z
    .enum(['naive', 'plan-first', 'template', 'compiler-check'])
    .describe('Only implemented strategies are allowed'),
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
  clientPort?: number; // Vite dev server port (5173)
  serverPort?: number; // Express API server port (3000)
  clientUrl?: string; // URL to access the client
  serverUrl?: string; // URL to access the API
  error?: string;
  containerId?: string;
}

export interface AppLog {
  sessionId: string;
  timestamp: number;
  type: 'stdout' | 'stderr';
  level: 'info' | 'warn' | 'error' | 'command' | 'system';
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
  sessionId: string;
  strategy?: string;
  model?: string;
  status?: 'completed' | 'cancelled' | 'failed';
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  duration: number;
  steps: number;
  // Compiler Check strategy metrics
  compilerIterations?: number;
  schemaValidationPassed?: boolean;
  typeCheckPassed?: boolean;
  totalCompilerErrors?: number;
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
  workspace_cleared: () => void;

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
