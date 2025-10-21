/**
 * Tool-related utilities for AI SDK integrations
 */

/**
 * Convert unknown tool input to Record<string, unknown>
 * @param input - Tool input from AI SDK
 * @returns Tool input as record or empty object
 */
export function toToolInput(input: unknown): Record<string, unknown> {
  if (typeof input === 'object' && input !== null) {
    return input as Record<string, unknown>;
  }
  return {};
}

/**
 * Convert unknown tool output to string
 * @param output - Tool output from AI SDK
 * @returns Stringified output
 */
export function toToolResult(output: unknown): string {
  if (typeof output === 'string') {
    return output;
  }
  return JSON.stringify(output);
}
