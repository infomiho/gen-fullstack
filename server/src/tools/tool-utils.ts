/**
 * Shared utilities for LLM tool implementations
 */

/**
 * Context passed to tools via experimental_context
 *
 * This context is provided by the AI SDK and includes session information
 * and WebSocket connections for real-time updates.
 */
export interface ToolContext {
  sessionId: string;
  io?: { to: (room: string) => { emit: (event: string, data: unknown) => void } };
}

/**
 * Extract tool context from experimental_context parameter
 *
 * @param context - The experimental_context provided by AI SDK
 * @returns Typed ToolContext object
 */
export function extractToolContext(context: unknown): ToolContext {
  return context as ToolContext;
}
