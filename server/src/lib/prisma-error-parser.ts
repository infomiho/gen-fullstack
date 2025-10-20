/**
 * Prisma Error Parser
 *
 * Parses Prisma CLI error messages from stderr output.
 * Handles multi-line error blocks with indented context.
 */

/**
 * Check if a line is the start of a Prisma error block
 */
function isErrorHeader(trimmed: string): boolean {
  return trimmed.startsWith('Error:') || /error/i.test(trimmed);
}

/**
 * Check if a line is indented context within an error block
 */
function isContextLine(line: string, trimmed: string, inErrorBlock: boolean): boolean {
  return inErrorBlock && line.startsWith(' ') && trimmed.length > 0;
}

/**
 * Check if error block should end
 */
function shouldEndErrorBlock(line: string, inErrorBlock: boolean): boolean {
  return inErrorBlock && !line.startsWith(' ');
}

/**
 * Save current error block to errors array if it exists
 */
function saveErrorBlock(currentError: string[], errors: string[]): void {
  if (currentError.length > 0) {
    errors.push(currentError.join('\n'));
  }
}

/**
 * Parse Prisma error messages from stderr
 *
 * Handles multi-line error blocks by capturing error lines and their context.
 * Prisma errors typically follow patterns like:
 * - "Error: <message>"
 * - Lines containing "error" (case insensitive)
 * - Indented context lines following error headers
 *
 * @param stderr - Standard error output from Prisma CLI
 * @returns Array of error messages (may include multi-line errors)
 */
export function parsePrismaErrors(stderr: string): string[] {
  const errors: string[] = [];
  const lines = stderr.split('\n');

  let inErrorBlock = false;
  let currentError: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (isErrorHeader(trimmed)) {
      // Save previous error block if exists
      saveErrorBlock(currentError, errors);

      // Start new error block
      currentError = [trimmed];
      inErrorBlock = true;
    } else if (isContextLine(line, trimmed, inErrorBlock)) {
      // Continue error block with indented context
      currentError.push(trimmed);
    } else if (shouldEndErrorBlock(line, inErrorBlock)) {
      // End of error block (empty line or non-indented line)
      saveErrorBlock(currentError, errors);
      currentError = [];
      inErrorBlock = false;
    }
  }

  // Save the last error block
  saveErrorBlock(currentError, errors);

  // If no specific errors found, return the full stderr as fallback
  if (errors.length === 0 && stderr.trim()) {
    errors.push(stderr.trim());
  }

  return errors;
}
