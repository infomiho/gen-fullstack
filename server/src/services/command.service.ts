import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { commandLogger } from '../lib/logger.js';
import { getSandboxPath } from './filesystem.service.js';

const execAsync = promisify(exec);

/**
 * Whitelisted commands that can be executed
 *
 * Security: Only specific commands are allowed to prevent
 * arbitrary code execution. Commands are checked against this list.
 */
const COMMAND_WHITELIST = [
  'npm',
  'node',
  'tsc',
  'vite',
  'ls',
  'cat',
  'echo',
  'mkdir',
  'pwd',
] as const;

/**
 * Default execution timeout in milliseconds
 */
const DEFAULT_EXECUTION_TIMEOUT_MS = 120000; // 2 minutes

/**
 * Maximum output size in characters to prevent memory issues
 */
const MAX_OUTPUT_SIZE = 50000;

/**
 * Result of command execution
 */
export interface CommandResult {
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
  /** Exit code */
  exitCode: number;
  /** Execution time in milliseconds */
  executionTime: number;
  /** Whether command was successful */
  success: boolean;
}

/**
 * Validate command against whitelist
 *
 * @param command - Command string to validate
 * @throws Error if command is not whitelisted
 */
function validateCommand(command: string): void {
  const trimmed = command.trim();
  if (!trimmed) {
    throw new Error('Command cannot be empty');
  }

  const baseCommand = trimmed.split(/\s+/)[0];

  const isWhitelisted = COMMAND_WHITELIST.some(
    (allowed) => baseCommand === allowed || baseCommand.startsWith(`${allowed}`),
  );

  if (!isWhitelisted) {
    throw new Error(
      `Command "${baseCommand}" is not whitelisted. ` +
        `Allowed commands: ${COMMAND_WHITELIST.join(', ')}`,
    );
  }

  if (command.includes('&&') || command.includes('||') || command.includes(';')) {
    throw new Error('Command chaining with &&, ||, or ; is not allowed for security reasons');
  }

  if (command.includes('`') || command.includes('$(') || /\$[A-Za-z_]/.test(command)) {
    throw new Error(
      'Command substitution with `, $(), or $VAR is not allowed for security reasons',
    );
  }

  if (command.includes('|')) {
    throw new Error('Pipe operator | is not allowed for security reasons');
  }
}

/**
 * Truncate output if it exceeds maximum size
 *
 * @param output - Output string to truncate
 * @returns Truncated output
 */
function truncateOutput(output: string): string {
  if (output.length <= MAX_OUTPUT_SIZE) {
    return output;
  }

  const truncated = output.slice(0, MAX_OUTPUT_SIZE);
  return `${truncated}\n\n... (output truncated, ${output.length - MAX_OUTPUT_SIZE} characters omitted)`;
}

/**
 * Execute a command within the sandbox directory
 *
 * @param sessionId - Session identifier
 * @param command - Command to execute
 * @param timeoutMs - Optional timeout in milliseconds (default: 120000ms / 2 minutes)
 * @returns Command execution result
 */
export async function executeCommand(
  sessionId: string,
  command: string,
  timeoutMs: number = DEFAULT_EXECUTION_TIMEOUT_MS,
): Promise<CommandResult> {
  const startTime = Date.now();

  validateCommand(command);

  const sandboxPath = getSandboxPath(sessionId);

  commandLogger.info({ workingDir: sandboxPath, command }, 'Executing command');

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: sandboxPath,
      timeout: timeoutMs,
      maxBuffer: MAX_OUTPUT_SIZE * 2, // Buffer for both stdout and stderr
      env: {
        ...process.env,
        // Prevent commands from accessing outside sandbox
        PWD: sandboxPath,
      },
    });

    const executionTime = Date.now() - startTime;

    const result: CommandResult = {
      stdout: truncateOutput(stdout),
      stderr: truncateOutput(stderr),
      exitCode: 0,
      executionTime,
      success: true,
    };

    commandLogger.info(
      {
        command,
        executionTime,
        stdoutBytes: stdout.length,
        stderrBytes: stderr.length,
      },
      'Command succeeded',
    );

    return result;
  } catch (error: unknown) {
    const executionTime = Date.now() - startTime;
    const err = error as {
      killed?: boolean;
      signal?: string;
      stdout?: string;
      stderr?: string;
      code?: number;
      message?: string;
    };

    if (err.killed && err.signal === 'SIGTERM') {
      commandLogger.error({ command, timeoutMs }, 'Command timeout');
      return {
        stdout: err.stdout ? truncateOutput(err.stdout) : '',
        stderr: `Command timed out after ${timeoutMs}ms`,
        exitCode: -1,
        executionTime,
        success: false,
      };
    }

    commandLogger.error({ command, executionTime, error: err.message }, 'Command failed');

    return {
      stdout: err.stdout ? truncateOutput(err.stdout) : '',
      stderr: err.stderr ? truncateOutput(err.stderr) : err.message || 'Unknown error',
      exitCode: err.code || 1,
      executionTime,
      success: false,
    };
  }
}

/**
 * Format command result for LLM consumption
 *
 * @param result - Command execution result
 * @returns Formatted string for LLM
 */
export function formatCommandResult(result: CommandResult): string {
  const parts: string[] = [
    `Command ${result.success ? 'succeeded' : 'failed'} (exit code: ${result.exitCode})`,
    `Execution time: ${result.executionTime}ms`,
  ];

  if (result.stdout) {
    parts.push(`\nStdout:\n${result.stdout}`);
  }

  if (result.stderr) {
    parts.push(`\nStderr:\n${result.stderr}`);
  }

  return parts.join('\n');
}

/**
 * Get list of allowed commands
 *
 * @returns Array of whitelisted command names
 */
export function getAllowedCommands(): readonly string[] {
  return COMMAND_WHITELIST;
}
