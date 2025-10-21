/**
 * TypeScript Validation Utility
 *
 * Shared validation logic for TypeScript compilation across client and server workspaces.
 * Used by ValidationCapability and ErrorFixingCapability to avoid code duplication.
 */

import type { TypeScriptError } from './typescript-error-parser.js';
import { parseTypeScriptErrors } from './typescript-error-parser.js';

/**
 * Validate TypeScript in both client and server workspaces
 *
 * Runs TypeScript compiler in check mode (--noEmit) for both workspaces
 * and aggregates all errors from both compilations.
 *
 * @param sessionId - Session ID for sandbox resolution
 * @returns Array of TypeScript errors from both workspaces
 */
export async function validateTypeScript(sessionId: string): Promise<TypeScriptError[]> {
  const { executeCommand } = await import('../services/command.service.js');

  const allErrors: TypeScriptError[] = [];

  // Check server TypeScript
  const serverResult = await executeCommand(
    sessionId,
    'npx tsc --noEmit --project server/tsconfig.json',
    60000, // 60 second timeout
  );

  if (!serverResult.success) {
    const serverErrors = parseTypeScriptErrors(serverResult.stdout, 'server');
    allErrors.push(...serverErrors);
  }

  // Check client TypeScript
  const clientResult = await executeCommand(
    sessionId,
    'npx tsc --noEmit --project client/tsconfig.json',
    60000, // 60 second timeout
  );

  if (!clientResult.success) {
    const clientErrors = parseTypeScriptErrors(clientResult.stdout, 'client');
    allErrors.push(...clientErrors);
  }

  return allErrors;
}
