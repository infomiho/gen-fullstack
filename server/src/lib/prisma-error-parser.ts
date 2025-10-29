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

// Regex patterns for parsing Prisma output
/** Matches context lines with line numbers (e.g., "17 | code here") */
const CONTEXT_LINE_REGEX = /^\d+\s*\|/;

/** Extracts line number from location string (e.g., "schema.prisma:18" -> 18) */
const LOCATION_LINE_NUMBER_REGEX = /:(\d+)$/;

/** Matches location indicators in Prisma output (e.g., "-->  schema.prisma:18") */
const LOCATION_INDICATOR_REGEX = /-->\s+(.+)/;

/**
 * Strip ANSI color codes from a string
 */
function stripAnsiCodes(text: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape codes require control characters
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Structured Prisma error with location and context information
 *
 * This is an intermediate type used during Prisma error parsing. It's exported
 * for testing purposes but is typically converted to `ValidationError` from the
 * shared package for cross-boundary communication.
 *
 * **Type Location Decision**: This interface stays in the parser utility rather
 * than the shared package because:
 * - It's specific to Prisma CLI output parsing (implementation detail)
 * - It's only used server-side during parsing
 * - `ValidationError` in shared package is the type that crosses boundaries
 * - Keeping it here maintains separation of concerns (parsing vs validation)
 */
export interface PrismaError {
  message: string;
  line?: number;
  location?: string;
  context?: string[];
}

/**
 * Parse a single Prisma error block
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Parser needs to handle multiple Prisma output formats
function parseErrorBlock(lines: string[], startIndex: number): PrismaError | null {
  let message = '';
  let location: string | undefined;
  const context: string[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    const stripped = stripAnsiCodes(line).trim();

    if (stripped.startsWith('error:')) {
      // Stop if we encounter the next error
      if (message) {
        break;
      }
      message = stripped.replace(/^error:\s*/, '');
      continue;
    }

    if (stripped.includes('-->')) {
      const match = stripped.match(LOCATION_INDICATOR_REGEX);
      if (match) {
        location = match[1];
      }
      continue;
    }

    if (CONTEXT_LINE_REGEX.test(stripped)) {
      context.push(stripped);
      continue;
    }

    // Empty line signals end of error block if we have context
    if (stripped === '') {
      if (context.length > 0) {
        break;
      }
      continue;
    }

    // Skip separator lines
    if (stripped === '|') {
      continue;
    }

    // Stop at validation error count or next error header
    if (stripped.startsWith('Validation Error Count:') || stripped.startsWith('Error:')) {
      break;
    }
  }

  if (!message) {
    return null;
  }

  // Extract line number from location (e.g., "schema.prisma:18" -> 18)
  let line: number | undefined;
  if (location) {
    const lineMatch = location.match(LOCATION_LINE_NUMBER_REGEX);
    if (lineMatch) {
      line = parseInt(lineMatch[1], 10);
    }
  }

  return { message, line, location, context };
}

/**
 * Parse Prisma error messages from stderr
 *
 * Extracts meaningful error messages with locations and code context.
 * Strips ANSI color codes and returns structured error objects.
 *
 * @param stderr - Standard error output from Prisma CLI
 * @returns Array of structured Prisma errors
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Parser needs to iterate through lines and build structured errors
export function parsePrismaErrors(stderr: string): PrismaError[] {
  const errors: PrismaError[] = [];
  const lines = stderr.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const stripped = stripAnsiCodes(line).trim();

    if (stripped.startsWith('error:')) {
      const parsed = parseErrorBlock(lines, i);
      if (parsed) {
        errors.push(parsed);
      }
    }
  }

  // If no structured errors found, return cleaned stderr as fallback
  if (errors.length === 0 && stderr.trim()) {
    errors.push({ message: stripAnsiCodes(stderr.trim()) });
  }

  // Deduplicate errors by message + line + location
  // Some Prisma output formats may include the same error multiple times
  const seen = new Set<string>();
  const deduplicatedErrors = errors.filter((err) => {
    const key = `${err.message}|${err.line ?? 'none'}|${err.location ?? 'none'}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  return deduplicatedErrors;
}
