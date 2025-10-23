import { tool } from 'ai';
import { z } from 'zod';
import { checkFileSafety } from '../lib/file-safety.js';
import { databaseLogger } from '../lib/logger.js';
import * as commandService from '../services/command.service.js';
import * as filesystemService from '../services/filesystem.service.js';
import { requestBlock } from './request-block.tool.js';
import { extractToolContext } from './tool-utils.js';

/**
 * Tool definitions for LLM-powered app generation
 *
 * These tools allow the LLM to interact with the filesystem and execute commands
 * within a sandboxed environment for each session.
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
        if (io) {
          io.to(sessionId).emit('message', {
            role: 'system',
            content: safetyCheck.warning,
            timestamp: Date.now(),
          });
        }
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
 * List files in a directory
 *
 * Returns a list of all files and subdirectories in the specified directory.
 * Use this to explore the project structure.
 */
export const listFiles = tool({
  description:
    'List all files and directories in a given path. Use this to explore the project structure.',
  inputSchema: z.object({
    directory: z.string().describe('Relative path to the directory (use "." for root directory)'),
    reason: z
      .string()
      .min(10)
      .max(200)
      .describe(
        'Brief explanation of why you need to list this directory and what you are looking for (10-200 characters)',
      ),
  }),
  execute: async ({ directory }, { experimental_context: context }) => {
    const { sessionId } = extractToolContext(context);
    // Default to root if empty or not provided
    const dir = directory || '.';
    const files = await filesystemService.listFiles(sessionId, dir);

    // Format output for LLM
    const fileList = files
      .map((f) => `${f.type === 'directory' ? '📁' : '📄'} ${f.name}`)
      .join('\n');
    return `Contents of "${dir}":\n${fileList}`;
  },
});

/**
 * Execute a shell command
 *
 * Runs a whitelisted command in the project directory.
 * Useful for installing dependencies, building, or running tests.
 */
export const executeCommand = tool({
  description: `Execute a shell command in the project directory.
Allowed commands: ${commandService.getAllowedCommands().join(', ')}.
Use this to install packages (npm install), run builds (npm build), or execute the app.`,
  inputSchema: z.object({
    command: z
      .string()
      .describe('Command to execute (e.g., "npm install", "npm dev", "npm build")'),
    reason: z
      .string()
      .min(10)
      .max(200)
      .describe(
        'Brief explanation of why you need to execute this command and what it will accomplish (10-200 characters)',
      ),
  }),
  execute: async ({ command }, { experimental_context: context }) => {
    const { sessionId } = extractToolContext(context);
    const result = await commandService.executeCommand(sessionId, command);
    return commandService.formatCommandResult(result);
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
    'Create an architectural plan for the application (database models, API routes, components). Use this before implementing to ensure a well-structured app.',
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
  execute: async (
    { databaseModels, apiRoutes, clientComponents },
    { experimental_context: context },
  ) => {
    const { sessionId, io } = extractToolContext(context);

    // Format plan as structured text
    const plan = `ARCHITECTURAL PLAN:

DATABASE MODELS:
${databaseModels.map((m) => `- ${m.name}\n  Fields: ${m.fields.join(', ')}\n  Relations: ${m.relations?.join(', ') || 'None'}`).join('\n')}

API ROUTES:
${apiRoutes.map((r) => `- ${r.method} ${r.path}: ${r.description}`).join('\n')}

CLIENT COMPONENTS:
${clientComponents.map((c) => `- ${c.name}: ${c.purpose}${c.key_features ? `\n  Features: ${c.key_features.join(', ')}` : ''}`).join('\n')}`;

    // Emit plan as system message
    if (io) {
      io.to(sessionId).emit('message', {
        role: 'system',
        content: `✓ Architectural plan created:\n${plan}`,
        timestamp: Date.now(),
      });
    }

    return `Plan created successfully. Proceed with implementation following this structure.`;
  },
});

/**
 * Parse Prisma validation errors into structured format
 */
function parsePrismaErrors(output: string): Array<{
  line?: number;
  message: string;
}> {
  const errors: Array<{ line?: number; message: string }> = [];

  // Prisma error format varies, but often includes "Error:" or line numbers
  // Example: "Error validating model \"User\": ..."
  // Example: "  --> schema.prisma:12"

  const lines = output.split('\n');
  let currentError = '';
  let currentLine: number | undefined;

  for (const line of lines) {
    // Check for line number indicators
    const lineMatch = line.match(/-->\s+schema\.prisma:(\d+)/);
    if (lineMatch) {
      currentLine = parseInt(lineMatch[1], 10);
      continue;
    }

    // Check for error messages
    if (line.includes('Error') || line.trim().startsWith('×')) {
      if (currentError) {
        errors.push({ line: currentLine, message: currentError.trim() });
        currentError = '';
        currentLine = undefined;
      }
      currentError = line;
    } else if (currentError && line.trim()) {
      currentError += ` ${line.trim()}`;
    }
  }

  // Add last error if exists
  if (currentError) {
    errors.push({ line: currentLine, message: currentError.trim() });
  }

  // If no structured errors found, treat whole output as one error
  if (errors.length === 0 && output.trim()) {
    errors.push({ message: output.trim() });
  }

  return errors;
}

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
      // Run prisma validate
      const validateResult = await commandService.executeCommand(sessionId, 'npx prisma validate');

      if (validateResult.exitCode === 0) {
        if (io) {
          io.to(sessionId).emit('llm_message', {
            id: `${Date.now()}-system`,
            role: 'system',
            content: '✓ Prisma schema validation passed',
            timestamp: Date.now(),
          });
        }
        return 'Schema is valid. You can now run "npx prisma generate" to create the Prisma client.';
      } else {
        // Extract and parse error details
        const errorOutput = validateResult.stderr || validateResult.stdout;
        const parsedErrors = parsePrismaErrors(errorOutput);
        const errorCount = parsedErrors.length;

        const formattedErrors = parsedErrors
          .map((e) => (e.line ? `Line ${e.line}: ${e.message}` : e.message))
          .join('\n\n');

        if (io) {
          io.to(sessionId).emit('llm_message', {
            id: `${Date.now()}-system`,
            role: 'system',
            content: `✗ Prisma schema validation failed (${errorCount} errors)`,
            timestamp: Date.now(),
          });
        }

        return `Schema validation failed (${errorCount} errors). Fix these:\n\n${formattedErrors}`;
      }
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
function parseTypeScriptErrors(output: string): Array<{
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
}> {
  const errors: Array<{
    file: string;
    line: number;
    column: number;
    code: string;
    message: string;
  }> = [];

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

    const results: { target: string; passed: boolean; errorCount: number; errors: string }[] = [];

    try {
      if (target === 'client' || target === 'both') {
        const clientResult = await commandService.executeCommand(
          sessionId,
          'npx tsc --noEmit --project client/tsconfig.json',
        );
        const output = clientResult.stderr || clientResult.stdout;
        const parsedErrors = parseTypeScriptErrors(output);

        results.push({
          target: 'client',
          passed: clientResult.exitCode === 0,
          errorCount: parsedErrors.length,
          errors:
            parsedErrors.length > 0
              ? parsedErrors
                  .map((e) => `${e.file}:${e.line}:${e.column} - ${e.code}: ${e.message}`)
                  .join('\n')
              : '',
        });
      }

      if (target === 'server' || target === 'both') {
        const serverResult = await commandService.executeCommand(
          sessionId,
          'npx tsc --noEmit --project server/tsconfig.json',
        );
        const output = serverResult.stderr || serverResult.stdout;
        const parsedErrors = parseTypeScriptErrors(output);

        results.push({
          target: 'server',
          passed: serverResult.exitCode === 0,
          errorCount: parsedErrors.length,
          errors:
            parsedErrors.length > 0
              ? parsedErrors
                  .map((e) => `${e.file}:${e.line}:${e.column} - ${e.code}: ${e.message}`)
                  .join('\n')
              : '',
        });
      }

      // Format results
      const allPassed = results.every((r) => r.passed);
      const totalErrors = results.reduce((sum, r) => sum + r.errorCount, 0);

      if (allPassed) {
        if (io) {
          io.to(sessionId).emit('llm_message', {
            id: `${Date.now()}-system`,
            role: 'system',
            content: `✓ TypeScript validation passed for ${target}`,
            timestamp: Date.now(),
          });
        }
        return `All TypeScript checks passed for ${target}. No type errors found.`;
      } else {
        const errorSummary = results
          .filter((r) => !r.passed)
          .map((r) => `${r.target.toUpperCase()} (${r.errorCount} errors):\n${r.errors}`)
          .join('\n\n');

        if (io) {
          io.to(sessionId).emit('llm_message', {
            id: `${Date.now()}-system`,
            role: 'system',
            content: `✗ TypeScript validation failed for ${target} (${totalErrors} errors)`,
            timestamp: Date.now(),
          });
        }

        return `TypeScript validation failed (${totalErrors} errors). Fix these:\n\n${errorSummary}`;
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : 'Unknown error during TypeScript validation';
      return `Error running TypeScript validation: ${errorMsg}`;
    }
  },
});

/**
 * Update package.json by adding dependencies without removing existing ones
 *
 * CRITICAL: Use this instead of writeFile for package.json in template mode.
 * This preserves all template dependencies while adding new ones.
 */
export const updatePackageJson = tool({
  description:
    'Add dependencies to package.json without removing existing ones. Use this instead of writeFile for package.json files to preserve template dependencies.',
  inputSchema: z.object({
    target: z
      .enum(['root', 'client', 'server'])
      .describe('Which package.json to update (root, client, or server)'),
    dependencies: z
      .record(z.string())
      .optional()
      .describe('Dependencies to add (e.g., {"express": "^5.0.0"})'),
    devDependencies: z
      .record(z.string())
      .optional()
      .describe('Dev dependencies to add (e.g., {"typescript": "^5.0.0"})'),
    reason: z
      .string()
      .min(10)
      .max(200)
      .describe('Why you are adding these dependencies (10-200 characters)'),
  }),
  execute: async ({ target, dependencies, devDependencies }, { experimental_context: context }) => {
    const { sessionId } = extractToolContext(context);

    if (!dependencies && !devDependencies) {
      return 'No dependencies provided to add.';
    }

    return await filesystemService.updatePackageJson(
      sessionId,
      target,
      dependencies,
      devDependencies,
    );
  },
});

/**
 * All tools bundled for easy import
 */
export const tools = {
  writeFile,
  readFile,
  listFiles,
  executeCommand,
  requestBlock,
  planArchitecture,
  validatePrismaSchema,
  validateTypeScript,
  updatePackageJson,
};

/**
 * Tool names for reference
 */
export const TOOL_NAMES = Object.keys(tools) as Array<keyof typeof tools>;
