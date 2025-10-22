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

/**
 * Format tool error for display, avoiding duplicate "Error:" prefixes
 * @param error - Error from AI SDK tool execution
 * @returns Formatted error message
 */
export function formatToolError(error: unknown): string {
  if (!error) return 'Error: Unknown error occurred';

  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error);

  // Avoid double "Error:" prefix
  return message.startsWith('Error:') ? message : `Error: ${message}`;
}
