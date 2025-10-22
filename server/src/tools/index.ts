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
 * All tools bundled for easy import
 */
export const tools = {
  writeFile,
  readFile,
  listFiles,
  executeCommand,
  requestBlock,
};

/**
 * Tool names for reference
 */
export const TOOL_NAMES = Object.keys(tools) as Array<keyof typeof tools>;
