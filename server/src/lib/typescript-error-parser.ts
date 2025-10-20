/**
 * TypeScript Error Parser
 *
 * Parses TypeScript compiler (tsc) output and extracts structured error information.
 * Supports both common tsc output formats.
 */

/**
 * TypeScript error structure parsed from tsc output
 */
export interface TypeScriptError {
  file: string;
  line: number;
  column: number;
  code: string; // e.g., "TS2339"
  message: string;
}

/**
 * Parse TypeScript errors from tsc output
 *
 * Supports two common formats:
 * 1. file(line,col): error TSxxxx: message
 * 2. file:line:col - error TSxxxx: message
 *
 * @param output - Standard output from tsc command
 * @param workspace - Workspace name (server/client) for context
 * @returns Array of structured TypeScript errors
 */
export function parseTypeScriptErrors(output: string, workspace: string): TypeScriptError[] {
  const errors: TypeScriptError[] = [];

  // TypeScript format: "file(line,col): error TSxxxx: message"
  // Use [^\n]+ instead of .+ to avoid matching across lines
  const regex1 = /([^:(]+)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*([^\n]+)/g;
  for (const match of output.matchAll(regex1)) {
    errors.push({
      file: `${workspace}/${match[1].trim()}`,
      line: Number.parseInt(match[2], 10),
      column: Number.parseInt(match[3], 10),
      code: match[4],
      message: match[5].trim(),
    });
  }

  // TypeScript format: "file:line:col - error TSxxxx: message"
  const regex2 = /([^:]+):(\d+):(\d+)\s*-\s*error\s+(TS\d+):\s*([^\n]+)/g;
  for (const match of output.matchAll(regex2)) {
    errors.push({
      file: `${workspace}/${match[1].trim()}`,
      line: Number.parseInt(match[2], 10),
      column: Number.parseInt(match[3], 10),
      code: match[4],
      message: match[5].trim(),
    });
  }

  return errors;
}

/**
 * Format TypeScript errors for LLM consumption
 *
 * @param errors - Array of TypeScript errors
 * @returns Formatted error string for LLM
 */
export function formatTypeScriptErrorsForLLM(errors: TypeScriptError[]): string {
  const errorCount = errors.length;
  const maxErrorsToShow = 10;

  let message = `TypeScript found ${errorCount} type error${errorCount === 1 ? '' : 's'}:\n\n`;

  const errorsToShow = errors.slice(0, maxErrorsToShow);
  for (let i = 0; i < errorsToShow.length; i++) {
    const e = errorsToShow[i];
    message += `${i + 1}. ${e.file}:${e.line}:${e.column} - ${e.code}: ${e.message}\n`;
  }

  if (errorCount > maxErrorsToShow) {
    message += `\n... and ${errorCount - maxErrorsToShow} more errors\n`;
  }

  message += '\nFix these errors by updating the relevant files.';

  return message;
}
