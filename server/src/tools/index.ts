import { tool } from 'ai';
import { z } from 'zod';
import type { CapabilityConfig } from '@gen-fullstack/shared';
import { checkFileSafety } from '../lib/file-safety.js';
import { databaseLogger, commandLogger } from '../lib/logger.js';
import { emitPersistedMessage } from '../lib/message-utils.js';
import type { TypeScriptError } from '../lib/typescript-error-parser.js';
import * as commandService from '../services/command.service.js';
import * as filesystemService from '../services/filesystem.service.js';
import { requestBlock } from './request-block.tool.js';
import { extractToolContext, type ToolContext } from './tool-utils.js';
import { parsePrismaErrors } from '../lib/prisma-error-parser.js';

/**
 * Tool definitions for LLM-powered app generation
 *
 * These tools allow the LLM to interact with the filesystem within a sandboxed
 * environment for each session. Command execution (npm install, prisma generate, etc.)
 * is handled by explicit phases in the Docker service, not via LLM tool calls.
 */

/**
 * Write content to a file
 *
 * Creates or overwrites a file with the specified content.
 * All paths are relative to the session sandbox directory.
 */
export const writeFile = tool({
  description:
    'Write content to a file. Creates directories if needed. Use this to create or update any file in the project.',
  inputSchema: z.object({
    path: z.string().describe('Relative path to the file (e.g., "src/App.tsx", "package.json")'),
    content: z.string().describe('Full content to write to the file'),
    reason: z
      .string()
      .min(10)
      .max(200)
      .describe(
        'Brief explanation of why you are writing this file and what problem it solves (10-200 characters)',
      ),
  }),
  execute: async ({ path, content }, { experimental_context: context }) => {
    const { sessionId, io } = extractToolContext(context);

    // Safety check: warn about large code deletions
    try {
      const existingContent = await filesystemService.readFile(sessionId, path);
      const safetyCheck = checkFileSafety(existingContent, content, path);

      if (!safetyCheck.isSafe && safetyCheck.warning) {
        emitPersistedMessage(sessionId, io, 'system', safetyCheck.warning);
        databaseLogger.warn(
          {
            sessionId,
            path,
            oldSize: safetyCheck.oldSize,
            newSize: safetyCheck.newSize,
            reductionPercent: safetyCheck.reductionPercent,
          },
          safetyCheck.warning,
        );
      }
    } catch (err) {
      // Only ignore ENOENT (file not found) - log other errors
      if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
        // File doesn't exist (new file) - no warning needed
      } else {
        databaseLogger.warn(
          { error: err, sessionId, path },
          'Unexpected error during safety check',
        );
      }
    }

    // Emit file_updated event immediately (real-time streaming) to session room
    if (io) {
      io.to(sessionId).emit('file_updated', {
        path,
        content,
      });
    }

    // Write file to filesystem AND database (atomic operation)
    // filesystemService.writeFile now handles both disk and database writes
    const result = await filesystemService.writeFile(sessionId, path, content);

    return result;
  },
});

/**
 * Read content from a file
 *
 * Reads and returns the content of an existing file.
 * Use this to check what's already in a file before modifying it.
 */
export const readFile = tool({
  description:
    'Read the content of an existing file. Use this to check current file contents before making changes.',
  inputSchema: z.object({
    path: z.string().describe('Relative path to the file to read (e.g., "src/App.tsx")'),
    reason: z
      .string()
      .min(10)
      .max(200)
      .describe(
        'Brief explanation of why you need to read this file and what information you are looking for (10-200 characters)',
      ),
  }),
  execute: async ({ path }, { experimental_context: context }) => {
    const { sessionId } = extractToolContext(context);
    return await filesystemService.readFile(sessionId, path);
  },
});

/**
 * Get complete file tree
 *
 * Returns a tree-style view of all files and directories in the project,
 * excluding common build artifacts and dependencies.
 * Use this once at the start to understand the full project layout.
 */
export const getFileTree = tool({
  description:
    'Get a complete tree view of the project structure. Returns all files and directories in a hierarchical format. Use this once at the start to understand the full project layout.',
  inputSchema: z.object({
    reason: z
      .string()
      .min(10)
      .max(200)
      .describe(
        'Brief explanation of why you need the file tree and what you are looking for (10-200 characters)',
      ),
  }),
  execute: async (_params, { experimental_context: context }) => {
    const { sessionId } = extractToolContext(context);
    return await filesystemService.getFileTree(sessionId);
  },
});

/**
 * Plan the application architecture before implementation
 *
 * Use this tool to create a structured plan with database schema,
 * API routes, and component structure before writing code.
 */
export const planArchitecture = tool({
  description:
    'Create an architectural plan for the application (database models, API routes, client routes, components). Use this before implementing to ensure a well-structured app.\n\nIMPORTANT - ID Types: Use String for IDs from external APIs/services. External IDs can be large numbers, UUIDs, or custom formats. Use Int only for internal auto-increment IDs.',
  inputSchema: z.object({
    databaseModels: z
      .array(
        z.object({
          name: z.string().describe('Model name (e.g., "User", "Post")'),
          fields: z
            .array(z.string())
            .describe('Field definitions (e.g., "id String @id", "email String @unique")'),
          relations: z
            .array(z.string())
            .optional()
            .describe('Relationships to other models (e.g., "posts Post[]")'),
        }),
      )
      .describe('Prisma database models'),
    apiRoutes: z
      .array(
        z.object({
          method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).describe('HTTP method'),
          path: z.string().describe('API endpoint path (e.g., "/api/users")'),
          description: z.string().describe('What this endpoint does'),
        }),
      )
      .describe('RESTful API endpoints'),
    clientRoutes: z
      .array(
        z.object({
          path: z.string().describe('Route path (e.g., "/", "/repos", "/repos/:id")'),
          componentName: z.string().describe('Component name (e.g., "HomePage", "RepoPage")'),
          description: z.string().describe('What this route displays'),
        }),
      )
      .optional()
      .describe('Client routes mapping URL paths to page components'),
    clientComponents: z
      .array(
        z.object({
          name: z.string().describe('Component name (e.g., "LoginForm", "UserList")'),
          purpose: z.string().describe('What this component does'),
          key_features: z.array(z.string()).optional().describe('Key features or functionality'),
        }),
      )
      .describe('React components to create'),
    reason: z
      .string()
      .min(10)
      .max(200)
      .describe('Why you are creating this plan and what problem it solves (10-200 characters)'),
  }),
  execute: async ({ databaseModels, apiRoutes, clientRoutes, clientComponents }) => {
    // Tool validates that the LLM provided structured plan data
    // No longer emits verbose plan to timeline - LLM has the plan context already
    const routeCount = clientRoutes?.length ?? 0;
    return `Plan created successfully with ${databaseModels.length} database models, ${apiRoutes.length} API routes, ${routeCount} client routes, and ${clientComponents.length} client components. Proceed with implementation following this structure.`;
  },
});

/**
 * Validate Prisma schema for syntax and semantic errors
 *
 * Runs `npx prisma validate` to check the schema before generating the client.
 */
export const validatePrismaSchema = tool({
  description:
    'Validate the Prisma schema for errors. Use this after creating/modifying prisma/schema.prisma to catch errors early.',
  inputSchema: z.object({
    reason: z
      .string()
      .min(10)
      .max(200)
      .describe('Why you are validating the schema at this point (10-200 characters)'),
  }),
  execute: async (_params, { experimental_context: context }) => {
    const { sessionId, io } = extractToolContext(context);

    try {
      const validateResult = await commandService.executeCommand(sessionId, 'npx prisma validate');

      if (validateResult.exitCode === 0) {
        emitPersistedMessage(sessionId, io, 'system', '✓ Prisma schema validation passed');
        return 'Schema is valid. You can now run "npx prisma generate" to create the Prisma client.';
      }

      const errorOutput = validateResult.stderr || validateResult.stdout;
      const parsedErrors = parsePrismaErrors(errorOutput);
      const errorCount = parsedErrors.length;

      const formattedErrors = parsedErrors
        .map((e) => {
          let errorStr = e.message;
          if (e.location) {
            errorStr += `\nLocation: ${e.location}`;
          }
          if (e.context && e.context.length > 0) {
            errorStr += `\nCode:\n${e.context.join('\n')}`;
          }
          return errorStr;
        })
        .join('\n\n');

      emitPersistedMessage(
        sessionId,
        io,
        'system',
        `✗ Prisma schema validation failed (${errorCount} errors)`,
      );

      return `Schema validation failed (${errorCount} errors). Fix these:\n\n${formattedErrors}`;
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Unknown error during Prisma validation';
      return `Error running Prisma validation: ${errorMsg}`;
    }
  },
});

/**
 * Parse TypeScript compiler errors into structured format
 */
function parseTypeScriptErrors(output: string): TypeScriptError[] {
  const errors: TypeScriptError[] = [];

  // TypeScript error format: path/file.ts(line,column): error TSxxxx: message
  const errorRegex = /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/gm;

  let match: RegExpExecArray | null = null;
  // biome-ignore lint/suspicious/noAssignInExpressions: Standard regex exec pattern
  while ((match = errorRegex.exec(output)) !== null) {
    errors.push({
      file: match[1],
      line: parseInt(match[2], 10),
      column: parseInt(match[3], 10),
      code: match[4],
      message: match[5],
    });
  }

  return errors;
}

/**
 * Helper: Format TypeScript errors for a specific target
 */
function formatTypeScriptErrors(parsedErrors: TypeScriptError[]) {
  return parsedErrors.length > 0
    ? parsedErrors
        .map((e) => `${e.file}:${e.line}:${e.column} - ${e.code}: ${e.message}`)
        .join('\n')
    : '';
}

/**
 * Helper: Build error message from command result
 */
function buildExecutionErrorMessage(result: {
  stdout: string;
  stderr: string;
  exitCode?: number;
}): string {
  const errorParts: string[] = [];

  if (result.stderr) {
    errorParts.push(result.stderr);
  }

  if (result.exitCode !== undefined && result.exitCode !== 0) {
    errorParts.push(`Exit code: ${result.exitCode}`);
  }

  if (result.stdout && !result.stderr) {
    // If stderr is empty but stdout has content, include it
    errorParts.push(`Output: ${result.stdout.substring(0, 200)}`);
  }

  return errorParts.length > 0 ? errorParts.join('\n') : 'Command execution failed with no output';
}

/**
 * Helper: Handle execution failures (not TypeScript compilation errors)
 */
function handleExecutionFailure(
  sessionId: string,
  target: 'client' | 'server',
  result: { success: boolean; stdout: string; stderr: string; exitCode?: number },
) {
  // Check if this looks like TypeScript compilation errors
  const combinedOutput = result.stdout + result.stderr;
  const hasTypeScriptErrors = combinedOutput.includes('error TS');

  // Log diagnostic information for debugging
  commandLogger.debug(
    {
      sessionId,
      target,
      exitCode: result.exitCode,
      hasTypeScriptErrors,
      stdoutLength: result.stdout.length,
      stderrLength: result.stderr.length,
      stdoutPreview: result.stdout.substring(0, 200),
      stderrPreview: result.stderr.substring(0, 200),
    },
    'TypeScript validation command result',
  );

  if (hasTypeScriptErrors) {
    return null; // Not an execution failure, fall through to parsing
  }

  // This is a real execution error (timeout, missing file, permission denied, etc.)
  const errorMessage = buildExecutionErrorMessage(result);

  commandLogger.error(
    {
      sessionId,
      target,
      exitCode: result.exitCode,
      errorMessage,
    },
    'TypeScript validation execution error',
  );

  return {
    target,
    passed: false,
    errorCount: 0,
    errors: '',
    executionError: errorMessage,
  };
}

/**
 * Helper: Run TypeScript validation for a target
 */
async function validateTarget(sessionId: string, target: 'client' | 'server') {
  const result = await commandService.executeCommand(
    sessionId,
    `npx tsc --noEmit --project ${target}/tsconfig.json`,
  );

  // Check if command execution itself failed (timeout, missing files, etc.)
  // BUT: TypeScript compilation errors (exit code 1) are NOT execution failures
  if (!result.success) {
    const executionError = handleExecutionFailure(sessionId, target, result);
    if (executionError) {
      return executionError;
    }
    // Fall through to parsing if it looks like TypeScript compilation errors
  }

  // Parse TypeScript output (prioritize stdout where TypeScript writes errors)
  const output = result.stdout || result.stderr;
  const parsedErrors = parseTypeScriptErrors(output);

  // Sanity check: if we got non-zero exit but parsed 0 errors, something went wrong
  if (parsedErrors.length === 0 && !result.success) {
    commandLogger.warn(
      {
        sessionId,
        target,
        exitCode: result.exitCode,
        outputLength: output.length,
        outputPreview: output.substring(0, 500),
      },
      'TypeScript failed but no errors parsed',
    );

    // Return the raw output so LLM can at least see what happened
    return {
      target,
      passed: false,
      errorCount: 1,
      errors:
        'TypeScript validation failed but errors could not be parsed. Raw output:\n' +
        output.substring(0, 500),
    };
  }

  // Trust parsed error count as source of truth for validation status
  return {
    target,
    passed: parsedErrors.length === 0,
    errorCount: parsedErrors.length,
    errors: formatTypeScriptErrors(parsedErrors),
  };
}

/**
 * Helper: Format validation results summary
 */
function formatValidationSummary(
  results: Array<{
    target: string;
    passed: boolean;
    errorCount: number;
    errors: string;
    executionError?: string;
  }>,
  target: string,
  sessionId: string,
  io: ToolContext['io'],
) {
  // Check for execution errors first (command timeout, missing files, etc.)
  const executionErrors = results.filter((r) => r.executionError);
  if (executionErrors.length > 0) {
    const errorDetails = executionErrors
      .map((r) => `${r.target.toUpperCase()}: ${r.executionError}`)
      .join('\n');

    emitPersistedMessage(
      sessionId,
      io,
      'system',
      `✗ TypeScript validation execution failed for ${target}`,
    );

    return `TypeScript validation could not complete due to execution errors:\n\n${errorDetails}`;
  }

  const allPassed = results.every((r) => r.passed);
  const totalErrors = results.reduce((sum, r) => sum + r.errorCount, 0);

  if (allPassed) {
    emitPersistedMessage(sessionId, io, 'system', `✓ TypeScript validation passed for ${target}`);
    return `All TypeScript checks passed for ${target}. No type errors found.`;
  }

  const errorSummary = results
    .filter((r) => !r.passed)
    .map((r) => `${r.target.toUpperCase()} (${r.errorCount} errors):\n${r.errors}`)
    .join('\n\n');

  emitPersistedMessage(
    sessionId,
    io,
    'system',
    `✗ TypeScript validation failed for ${target} (${totalErrors} errors)`,
  );

  return `TypeScript validation failed (${totalErrors} errors). Fix these:\n\n${errorSummary}`;
}

/**
 * Validate TypeScript code for type errors
 *
 * Runs `npx tsc --noEmit` to check for TypeScript errors without generating files.
 */
export const validateTypeScript = tool({
  description:
    'Run TypeScript compiler to check for type errors. Use this after writing code to catch type issues early.',
  inputSchema: z.object({
    target: z
      .enum(['client', 'server', 'both'])
      .describe('Which part to validate (client, server, or both)'),
    reason: z
      .string()
      .min(10)
      .max(200)
      .describe('Why you are validating TypeScript at this point (10-200 characters)'),
  }),
  execute: async ({ target }, { experimental_context: context }) => {
    const { sessionId, io } = extractToolContext(context);

    try {
      const results = [];

      if (target === 'client' || target === 'both') {
        results.push(await validateTarget(sessionId, 'client'));
      }

      if (target === 'server' || target === 'both') {
        results.push(await validateTarget(sessionId, 'server'));
      }

      return formatValidationSummary(results, target, sessionId, io);
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Unknown error during TypeScript validation';
      return `Error running TypeScript validation: ${errorMsg}`;
    }
  },
});

/**
 * Install npm dependencies to package.json
 *
 * Use this tool to add or update npm packages in package.json files.
 * It preserves all existing dependencies and package.json configuration.
 *
 * IMPORTANT: This tool is ONLY for installing dependencies.
 * - For adding dependencies: Use this tool
 * - For modifying scripts, name, version, etc.: Use writeFile
 *
 * Examples:
 * - Installing runtime deps: { target: "server", dependencies: {"express": "^5.0.0"} }
 * - Installing dev deps: { target: "client", devDependencies: {"@types/react": "^18.0.0"} }
 * - Installing both: { target: "server", dependencies: {...}, devDependencies: {...} }
 */
export const installNpmDep = tool({
  description: `Add dependencies to package.json without removing existing ones.

CRITICAL: You MUST provide a dependencies object with package names and versions.

Example:
{
  "target": "client",
  "dependencies": {
    "axios": "^1.7.0"
  }
}`,
  inputSchema: z.object({
    target: z
      .enum(['root', 'client', 'server'])
      .describe('Which package.json to update (root, client, or server)'),
    dependencies: z
      .record(z.string(), z.string())
      .nullable()
      .describe(
        'Dependencies to add with versions (e.g., {"express": "^5.0.0"}). Must provide this OR devDependencies.',
      ),
    devDependencies: z
      .record(z.string(), z.string())
      .nullable()
      .describe(
        'Dev dependencies to add with versions (e.g., {"typescript": "^5.0.0"}). Must provide this OR dependencies.',
      ),
    reason: z
      .string()
      .min(10)
      .max(200)
      .describe(
        'Brief explanation of why these packages are needed and how they will be used (10-200 characters)',
      ),
  }),
  execute: async ({ target, dependencies, devDependencies }, { experimental_context: context }) => {
    const { sessionId } = extractToolContext(context);

    // Validation in execute as safety net
    if (!dependencies && !devDependencies) {
      throw new Error(
        'Must provide either dependencies or devDependencies with package names and versions. ' +
          'Do not call this tool with only a reason field.',
      );
    }

    return await filesystemService.installNpmDep(
      sessionId,
      target,
      dependencies ?? undefined,
      devDependencies ?? undefined,
    );
  },
});

/**
 * Tools organized by capability
 *
 * This organization makes it clear which tools belong to which capability,
 * and simplifies the tool composition logic. Tools are grouped into separate
 * objects that are composed together based on the active capability configuration.
 */

/**
 * Base tools - always available regardless of configuration
 *
 * These tools provide fundamental file system capabilities that are needed
 * in all generation modes:
 * - writeFile: Create or update files in the session workspace
 * - readFile: Read existing file contents
 * - getFileTree: List complete project structure
 *
 * Note: Command execution (npm install, prisma generate, etc.) happens in
 * explicit phases controlled by the Docker service, not via LLM tool calls.
 *
 * @example
 * // Base tools are included in all capability configurations
 * const tools = getToolsForCapability({ inputMode: 'naive', ... });
 * // tools always includes: writeFile, readFile, getFileTree
 */
export const baseTools = {
  writeFile,
  readFile,
  getFileTree,
};

/**
 * Planning tools - only available when planning: true
 *
 * These tools enable architectural planning before implementation:
 * - planArchitecture: Create structured plan with database models, API routes, and components
 *
 * The planning capability allows the LLM to design the application architecture
 * before writing code, which can lead to more coherent and well-structured applications.
 *
 * @example
 * // Planning tools are included when planning is enabled
 * const tools = getToolsForCapability({ planning: true, ... });
 * // tools includes: ...baseTools, planArchitecture
 */
export const planTools = {
  planArchitecture,
};

/**
 * Template tools - only available when inputMode: 'template'
 *
 * These tools are specific to template-based generation where package.json files
 * already exist and need to be incrementally updated:
 * - installNpmDep: Add dependencies to existing package.json files
 *
 * When inputMode is 'template', the LLM starts with a pre-configured full-stack template
 * and adds new dependencies as needed. When inputMode is 'naive', the LLM writes complete
 * package.json files from scratch.
 *
 * @example
 * // Template tools are included only when inputMode: 'template'
 * const tools = getToolsForCapability({ inputMode: 'template', ... });
 * // tools includes: ...baseTools, installNpmDep
 */
export const templateTools = {
  installNpmDep,
};

/**
 * Compiler check tools - only available when compilerChecks: true
 *
 * These tools enable validation and iterative fixing of generated code:
 * - validatePrismaSchema: Validate Prisma schema for errors
 * - validateTypeScript: Run TypeScript compiler to check for type errors
 *
 * When compiler checks are enabled, the LLM can validate generated code
 * and automatically fix errors through multiple iterations. This significantly
 * improves code quality but increases generation time and token usage.
 *
 * @example
 * // Compiler check tools are included when compilerChecks is enabled
 * const tools = getToolsForCapability({ compilerChecks: true, ... });
 * // tools includes: ...baseTools, validatePrismaSchema, validateTypeScript
 */
export const compilerCheckTools = {
  validatePrismaSchema,
  validateTypeScript,
};

/**
 * Building blocks tools - only available when buildingBlocks: true
 *
 * These tools provide access to pre-built, reusable components:
 * - requestBlock: Copy pre-built building blocks (e.g., auth-password) into the project
 *
 * Building blocks accelerate development by providing battle-tested implementations
 * of common features. Each block includes server code, client components, database
 * models, and integration guides.
 *
 * @example
 * // Building blocks tools are included when buildingBlocks is enabled
 * const tools = getToolsForCapability({ buildingBlocks: true, ... });
 * // tools includes: ...baseTools, requestBlock
 */
export const buildingBlockTools = {
  requestBlock,
};

/**
 * All tools bundled (for reference and testing)
 */
export const tools = {
  ...baseTools,
  ...planTools,
  ...templateTools,
  ...compilerCheckTools,
  ...buildingBlockTools,
};

/**
 * Get tools composed by capability configuration
 *
 * Composes tool groups based on enabled capabilities:
 * - Base tools: always included (writeFile, readFile, getFileTree)
 * - Plan tools: included when planning is enabled
 * - Template tools: included when inputMode is 'template'
 * - Compiler check tools: included when compilerChecks is enabled
 * - Building blocks tools: included when buildingBlocks is enabled
 *
 * @param config - The capability configuration
 * @returns Composed tools object
 */
export function getToolsForCapability(config: CapabilityConfig) {
  // Start with base tools (always available)
  let composedTools = { ...baseTools };

  // Add planning tools if enabled
  if (config.planning) {
    composedTools = { ...composedTools, ...planTools };
  }

  // Add template tools if inputMode is 'template'
  if (config.inputMode === 'template') {
    composedTools = { ...composedTools, ...templateTools };
  }

  // Add compiler check tools if enabled
  if (config.compilerChecks) {
    composedTools = { ...composedTools, ...compilerCheckTools };
  }

  // Add building blocks tools if enabled
  if (config.buildingBlocks) {
    composedTools = { ...composedTools, ...buildingBlockTools };
  }

  return composedTools;
}
