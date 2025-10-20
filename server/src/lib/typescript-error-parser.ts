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
 * TypeScript error categories for better fix targeting
 */
export enum ErrorCategory {
  DEPENDENCY = 'dependency', // Cannot find module errors (TS2307)
  TYPE = 'type', // Type mismatches, missing properties, etc.
  CONFIG = 'config', // Configuration errors (TS18003, etc.)
}

/**
 * Categorized TypeScript errors
 */
export interface CategorizedErrors {
  dependency: TypeScriptError[];
  type: TypeScriptError[];
  config: TypeScriptError[];
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
    const filePath = match[1].trim();
    // Only prepend workspace if path doesn't already include it
    const normalizedPath = filePath.startsWith(`${workspace}/`)
      ? filePath
      : `${workspace}/${filePath}`;

    errors.push({
      file: normalizedPath,
      line: Number.parseInt(match[2], 10),
      column: Number.parseInt(match[3], 10),
      code: match[4],
      message: match[5].trim(),
    });
  }

  // TypeScript format: "file:line:col - error TSxxxx: message"
  // Use [^\n:] instead of [^:] to prevent matching across lines
  // File path ends at first :digit pattern
  const regex2 = /([^\n:]+):(\d+):(\d+)\s*-\s*error\s+(TS\d+):\s*([^\n]+)/g;
  for (const match of output.matchAll(regex2)) {
    const filePath = match[1].trim();
    // Only prepend workspace if path doesn't already include it
    const normalizedPath = filePath.startsWith(`${workspace}/`)
      ? filePath
      : `${workspace}/${filePath}`;

    errors.push({
      file: normalizedPath,
      line: Number.parseInt(match[2], 10),
      column: Number.parseInt(match[3], 10),
      code: match[4],
      message: match[5].trim(),
    });
  }

  return errors;
}

/**
 * Categorize TypeScript errors by type
 *
 * @param errors - Array of TypeScript errors
 * @returns Categorized errors
 */
export function categorizeErrors(errors: TypeScriptError[]): CategorizedErrors {
  const categorized: CategorizedErrors = {
    dependency: [],
    type: [],
    config: [],
  };

  for (const error of errors) {
    if (error.code === 'TS2307') {
      // Cannot find module
      categorized.dependency.push(error);
    } else if (error.code === 'TS18003' || error.code.startsWith('TS5')) {
      // Config errors (TS18003 = no input files, TS5xxx = config)
      categorized.config.push(error);
    } else {
      // All other errors are type-related
      categorized.type.push(error);
    }
  }

  return categorized;
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
  const categorized = categorizeErrors(errors);

  let message = `TypeScript found ${errorCount} type error${errorCount === 1 ? '' : 's'}:\n\n`;

  // Show dependency errors first (most critical)
  if (categorized.dependency.length > 0) {
    message += `⚠️ DEPENDENCY ERRORS (${categorized.dependency.length}):\n`;
    message += 'These indicate missing dependencies. If you see "Cannot find module" errors,\n';
    message +=
      'ensure dependencies are installed with npm install (already done in Phase 1.5).\n\n';

    const depErrors = categorized.dependency.slice(0, 5);
    for (let i = 0; i < depErrors.length; i++) {
      const e = depErrors[i];
      message += `${i + 1}. ${e.file}:${e.line}:${e.column} - ${e.code}: ${e.message}\n`;
    }
    if (categorized.dependency.length > 5) {
      message += `... and ${categorized.dependency.length - 5} more dependency errors\n`;
    }
    message += '\n';
  }

  // Show type errors (most common to fix)
  if (categorized.type.length > 0) {
    message += `TYPE ERRORS (${categorized.type.length}):\n`;

    // Calculate remaining slots based on how many dependency errors were actually shown
    const depErrorsShown = Math.min(categorized.dependency.length, 5);
    const remainingSlots = maxErrorsToShow - depErrorsShown;
    const typeErrors = categorized.type.slice(0, remainingSlots);

    for (let i = 0; i < typeErrors.length; i++) {
      const e = typeErrors[i];
      message += `${i + 1}. ${e.file}:${e.line}:${e.column} - ${e.code}: ${e.message}\n`;
    }
    if (categorized.type.length > typeErrors.length) {
      message += `... and ${categorized.type.length - typeErrors.length} more type errors\n`;
    }
    message += '\n';
  }

  // Show config errors (least common)
  if (categorized.config.length > 0) {
    message += `CONFIG ERRORS (${categorized.config.length}):\n`;
    for (const e of categorized.config) {
      message += `- ${e.file}:${e.line}:${e.column} - ${e.code}: ${e.message}\n`;
    }
    message += '\n';
  }

  message += '\nFix these errors by updating the relevant files.';

  return message;
}
