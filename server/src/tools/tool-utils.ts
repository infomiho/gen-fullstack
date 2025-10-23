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
 * Performs runtime validation to ensure the context has the required structure.
 * This prevents cryptic runtime errors if the context is malformed.
 *
 * @param context - The experimental_context provided by AI SDK
 * @returns Typed ToolContext object
 * @throws {Error} If context is missing or invalid
 */
export function extractToolContext(context: unknown): ToolContext {
  // Validate context exists and is an object
  if (!context || typeof context !== 'object') {
    throw new Error(
      'Invalid tool context: context is missing or not an object. ' +
        'Ensure experimental_context is passed when calling streamText.',
    );
  }

  const ctx = context as Record<string, unknown>;

  // Validate sessionId exists and is a string
  if (!ctx.sessionId || typeof ctx.sessionId !== 'string') {
    throw new Error(
      'Invalid tool context: sessionId is missing or not a string. ' +
        'Ensure experimental_context includes sessionId.',
    );
  }

  // io is optional, but if present should be an object
  if (ctx.io !== undefined && typeof ctx.io !== 'object') {
    throw new Error('Invalid tool context: io must be an object if provided.');
  }

  return {
    sessionId: ctx.sessionId,
    io: ctx.io as ToolContext['io'],
  };
}
