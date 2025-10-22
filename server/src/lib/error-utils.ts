/**
 * Error handling utilities
 */

/**
 * Safely extract error message from unknown error type
 * @param error - Unknown error object
 * @returns Error message string
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Check if error is an abort error
 * @param error - Unknown error object
 * @returns True if error is an AbortError
 */
export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

/**
 * Maximum length for error message previews
 */
const MAX_ERROR_PREVIEW_LENGTH = 200;

/**
 * Truncate error message to a reasonable length for display
 *
 * Long error messages (e.g., from npm install or TypeScript) can be overwhelming
 * and break UI layouts. This function truncates them while indicating that
 * truncation occurred.
 *
 * @param message - Error message to truncate
 * @param maxLength - Maximum length (default: 200 characters)
 * @returns Truncated message with ellipsis and character count if truncated
 *
 * @example
 * ```typescript
 * const longError = "npm ERR! " + "x".repeat(500);
 * truncateErrorMessage(longError);
 * // => "npm ERR! xxx...(truncated, 509 total chars)"
 * ```
 */
export function truncateErrorMessage(
  message: string,
  maxLength: number = MAX_ERROR_PREVIEW_LENGTH,
): string {
  if (message.length <= maxLength) {
    return message;
  }
  return `${message.substring(0, maxLength)}... (truncated, ${message.length} total chars)`;
}
