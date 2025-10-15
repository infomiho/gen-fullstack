import { tool } from 'ai';
import { z } from 'zod';
import * as commandService from '../services/command.service.js';
import * as filesystemService from '../services/filesystem.service.js';

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
  }),
  execute: async ({ path, content }, { experimental_context: context }) => {
    interface ToolContext {
      sessionId: string;
      socket?: { emit: (event: string, data: unknown) => void };
    }
    const ctx = context as ToolContext;
    const sessionId = ctx.sessionId;

    // Emit file_updated event immediately (real-time streaming)
    if (ctx.socket) {
      ctx.socket.emit('file_updated', {
        path,
        content,
      });
    }

    return await filesystemService.writeFile(sessionId, path, content);
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
  }),
  execute: async ({ path }, { experimental_context: context }) => {
    const sessionId = (context as { sessionId: string }).sessionId;
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
  }),
  execute: async ({ directory }, { experimental_context: context }) => {
    const sessionId = (context as { sessionId: string }).sessionId;
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
  }),
  execute: async ({ command }, { experimental_context: context }) => {
    const sessionId = (context as { sessionId: string }).sessionId;
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
};

/**
 * Tool names for reference
 */
export const TOOL_NAMES = Object.keys(tools) as Array<keyof typeof tools>;
