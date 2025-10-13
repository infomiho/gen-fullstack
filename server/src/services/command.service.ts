import { exec } from 'child_process';
import { promisify } from 'util';
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
  'pnpm',
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
 * Maximum execution timeout in milliseconds
 */
const EXECUTION_TIMEOUT_MS = 120000; // 2 minutes

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
  // Check for empty or whitespace-only command
  const trimmed = command.trim();
  if (!trimmed) {
    throw new Error('Command cannot be empty');
  }

  // Extract the base command (first word)
  const baseCommand = trimmed.split(/\s+/)[0];

  // Check if base command is in whitelist
  const isWhitelisted = COMMAND_WHITELIST.some(
    allowed => baseCommand === allowed || baseCommand.startsWith(`${allowed}`)
  );

  if (!isWhitelisted) {
    throw new Error(
      `Command "${baseCommand}" is not whitelisted. ` +
      `Allowed commands: ${COMMAND_WHITELIST.join(', ')}`
    );
  }

  // Additional security checks
  if (command.includes('&&') || command.includes('||') || command.includes(';')) {
    throw new Error(
      'Command chaining with &&, ||, or ; is not allowed for security reasons'
    );
  }

  // Check for command substitution and variable expansion
  if (command.includes('`') || command.includes('$(') || /\$[A-Za-z_]/.test(command)) {
    throw new Error(
      'Command substitution with `, $(), or $VAR is not allowed for security reasons'
    );
  }

  if (command.includes('|')) {
    throw new Error(
      'Pipe operator | is not allowed for security reasons'
    );
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
 * @returns Command execution result
 */
export async function executeCommand(
  sessionId: string,
  command: string,
): Promise<CommandResult> {
  const startTime = Date.now();

  // Validate command
  validateCommand(command);

  // Get sandbox directory
  const sandboxPath = getSandboxPath(sessionId);

  console.log(`[Command] Executing in ${sandboxPath}: ${command}`);

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: sandboxPath,
      timeout: EXECUTION_TIMEOUT_MS,
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

    console.log(
      `[Command] Success (${executionTime}ms): ${command} ` +
      `(stdout: ${stdout.length} bytes, stderr: ${stderr.length} bytes)`
    );

    return result;
  } catch (error: any) {
    const executionTime = Date.now() - startTime;

    // Handle timeout
    if (error.killed && error.signal === 'SIGTERM') {
      console.error(`[Command] Timeout after ${EXECUTION_TIMEOUT_MS}ms: ${command}`);
      return {
        stdout: error.stdout ? truncateOutput(error.stdout) : '',
        stderr: `Command timed out after ${EXECUTION_TIMEOUT_MS}ms`,
        exitCode: -1,
        executionTime,
        success: false,
      };
    }

    // Handle execution error
    console.error(`[Command] Failed (${executionTime}ms): ${command}`, error.message);

    return {
      stdout: error.stdout ? truncateOutput(error.stdout) : '',
      stderr: error.stderr ? truncateOutput(error.stderr) : error.message,
      exitCode: error.code || 1,
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
