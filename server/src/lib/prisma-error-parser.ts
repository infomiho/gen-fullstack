/**
 * Prisma Error Parser
 *
 * Parses Prisma CLI error messages from stderr output.
 * Extracts meaningful error messages and locations from Prisma validation output.
 *
 * Prisma errors typically follow this format:
 * ```
 * Error: Prisma schema validation - (validate wasm)
 * Error code: P1012
 * error: Error parsing attribute "@relation": ...
 *   -->  schema.prisma:18
 *    |
 * 17 |   userId Int
 * 18 |   user   User @relation(...)
 * 19 | }
 *    |
 * Validation Error Count: 1
 * ```
 */

/**
 * Strip ANSI color codes from a string
 */
function stripAnsiCodes(text: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape codes require control characters
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

interface ParsedError {
  message: string;
  location?: string;
  context?: string[];
}

/**
 * Parse a single Prisma error block
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Parser needs to handle multiple Prisma output formats
function parseErrorBlock(lines: string[], startIndex: number): ParsedError | null {
  let message = '';
  let location: string | undefined;
  const context: string[] = [];

  // Find the actual error message (starts with "error:")
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    const stripped = stripAnsiCodes(line).trim();

    // Main error message
    if (stripped.startsWith('error:')) {
      message = stripped.replace(/^error:\s*/, '');
      continue;
    }

    // Location line (-->)
    if (stripped.includes('-->')) {
      const match = stripped.match(/-->\s+(.+)/);
      if (match) {
        location = match[1];
      }
      continue;
    }

    // Context lines (numbered code lines)
    if (/^\d+\s*\|/.test(stripped)) {
      context.push(stripped);
      continue;
    }

    // Empty line - but only after we've found some context, otherwise keep looking
    if (stripped === '') {
      // If we've already captured context lines, this empty line signals the end
      if (context.length > 0) {
        break;
      }
      continue;
    }

    // Separator lines (just "|") - skip them, don't break
    if (stripped === '|') {
      continue;
    }

    // Stop at validation error count or next error
    if (stripped.startsWith('Validation Error Count:') || stripped.startsWith('Error:')) {
      break;
    }
  }

  if (!message) {
    return null;
  }

  return { message, location, context };
}

/**
 * Parse Prisma error messages from stderr
 *
 * Extracts meaningful error messages with locations and code context.
 * Strips ANSI color codes and formats errors for LLM consumption.
 *
 * @param stderr - Standard error output from Prisma CLI
 * @returns Array of formatted error messages
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Parser needs to iterate through lines and build formatted errors
export function parsePrismaErrors(stderr: string): string[] {
  const formattedErrors: string[] = [];
  const lines = stderr.split('\n');

  // Find all "error:" lines (these are the actual errors)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const stripped = stripAnsiCodes(line).trim();

    if (stripped.startsWith('error:')) {
      const parsed = parseErrorBlock(lines, i);
      if (parsed) {
        // Format the error for LLM consumption
        let formatted = parsed.message;

        if (parsed.location) {
          formatted += `\nLocation: ${parsed.location}`;
        }

        if (parsed.context && parsed.context.length > 0) {
          formatted += `\nCode:\n${parsed.context.join('\n')}`;
        }

        formattedErrors.push(formatted);
      }
    }
  }

  // If no structured errors found, return cleaned stderr as fallback
  if (formattedErrors.length === 0 && stderr.trim()) {
    formattedErrors.push(stripAnsiCodes(stderr.trim()));
  }

  return formattedErrors;
}
