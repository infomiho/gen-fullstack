import type { ValidationError } from '@gen-fullstack/shared';
import type { Server as SocketIOServer } from 'socket.io';
import { getErrorMessage } from '../lib/error-utils.js';
import * as commandService from '../services/command.service.js';
import type { ModelName } from '../services/llm.service.js';
import type {
  CapabilityContext,
  CapabilityResult,
  ClientToServerEvents,
  ServerToClientEvents,
} from '../types/index.js';
import { BaseCapability } from './base.capability.js';

/**
 * Validation Capability
 *
 * Runs compiler checks (Prisma schema validation + TypeScript type checking)
 * to validate generated code before proceeding to error fixing.
 *
 * This capability was extracted from the validation tools to enable
 * explicit pipeline orchestration in Phase B of the XState migration.
 *
 * Features:
 * - Validates Prisma schema syntax and semantics
 * - Validates TypeScript code for type errors (both client and server)
 * - Returns structured validation errors (not strings)
 * - No LLM calls - just runs compilers
 * - Skippable if compilerChecks: false
 *
 * Design Notes:
 * - This is a pure validation phase - no code fixes
 * - Returns empty array if all checks pass
 * - Returns array of ValidationError if checks fail
 * - Errors are stored in machine context for error fixing stage
 */
export class ValidationCapability extends BaseCapability {
  constructor(
    modelName: ModelName,
    io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  ) {
    super(modelName, io);
  }

  getName(): string {
    return 'Validation';
  }

  validateContext(context: CapabilityContext): void {
    if (!context.sessionId) {
      throw new Error('ValidationCapability requires context.sessionId');
    }
    if (!context.sandboxPath) {
      throw new Error('ValidationCapability requires context.sandboxPath');
    }
  }

  async execute(context: CapabilityContext): Promise<CapabilityResult> {
    this.validateContext(context);

    const { sessionId, sandboxPath } = context;
    const startTime = Date.now();

    try {
      this.emitMessage('assistant', 'Installing dependencies before validation...', sessionId);

      const installCallId = `install-deps-${Date.now()}`;
      try {
        this.emitToolCall(
          installCallId,
          'installDependencies',
          { path: sandboxPath! },
          sessionId,
          'Install npm dependencies for compilation',
        );

        const installResult = await commandService.executeCommand(sessionId, 'npm install', 180000);

        if (installResult.exitCode !== 0) {
          const errorOutput = installResult.stderr || installResult.stdout;
          this.emitToolResult(
            installCallId,
            'installDependencies',
            `✗ Dependency installation failed: ${errorOutput.substring(0, 500)}`,
            sessionId,
            true,
          );
          throw new Error(`Dependency installation failed: ${errorOutput.substring(0, 200)}`);
        }

        this.emitToolResult(
          installCallId,
          'installDependencies',
          '✓ Dependencies installed successfully',
          sessionId,
          false,
        );
      } catch (error) {
        this.emitToolResult(
          installCallId,
          'installDependencies',
          `Error: ${error instanceof Error ? error.message : String(error)}`,
          sessionId,
          true,
        );
        throw error;
      }

      this.emitMessage('assistant', 'Running compiler checks...', sessionId);

      const errors: ValidationError[] = [];

      const prismaCallId = `validate-prisma-${Date.now()}`;
      try {
        this.emitToolCall(
          prismaCallId,
          'validatePrisma',
          { path: `${sandboxPath}/prisma/schema.prisma` },
          sessionId,
          'Validate Prisma schema for syntax errors',
        );

        const prismaErrors = await this.validatePrismaSchema(sessionId, sandboxPath);
        errors.push(...prismaErrors);

        const prismaResult =
          prismaErrors.length === 0
            ? '✓ Prisma schema validation passed'
            : `✗ Found ${prismaErrors.length} Prisma error(s)`;

        this.emitToolResult(
          prismaCallId,
          'validatePrisma',
          prismaResult,
          sessionId,
          prismaErrors.length > 0,
        );
      } catch (error) {
        this.emitToolResult(
          prismaCallId,
          'validatePrisma',
          `Error: ${error instanceof Error ? error.message : String(error)}`,
          sessionId,
          true,
        );
        throw error;
      }

      const tsCallId = `validate-typescript-${Date.now()}`;
      try {
        this.emitToolCall(
          tsCallId,
          'validateTypeScript',
          { clientPath: `${sandboxPath}/client`, serverPath: `${sandboxPath}/server` },
          sessionId,
          'Run TypeScript compiler checks on client and server',
        );

        const tsErrors = await this.validateTypeScript(sessionId, sandboxPath);
        errors.push(...tsErrors);

        const tsResult =
          tsErrors.length === 0
            ? '✓ TypeScript validation passed'
            : `✗ Found ${tsErrors.length} TypeScript error(s)`;

        this.emitToolResult(
          tsCallId,
          'validateTypeScript',
          tsResult,
          sessionId,
          tsErrors.length > 0,
        );
      } catch (error) {
        this.emitToolResult(
          tsCallId,
          'validateTypeScript',
          `Error: ${error instanceof Error ? error.message : String(error)}`,
          sessionId,
          true,
        );
        throw error;
      }

      if (errors.length === 0) {
        this.emitMessage('assistant', '✓ All compiler checks passed', sessionId);
      } else {
        this.emitMessage(
          'assistant',
          `Found ${errors.length} validation errors that need fixing`,
          sessionId,
        );
      }

      return {
        success: true,
        tokensUsed: { input: 0, output: 0 },
        cost: 0,
        toolCalls: 0,
        contextUpdates: {
          validationErrors: errors,
        },
      };
    } catch (error) {
      const errorMessage = getErrorMessage(error);

      this.logger.error(
        {
          sessionId,
          error: errorMessage,
          duration: Date.now() - startTime,
        },
        'Validation capability failed',
      );

      this.emitMessage('system', `✗ Validation failed: ${errorMessage}`, sessionId);

      return {
        success: false,
        error: errorMessage,
        tokensUsed: { input: 0, output: 0 },
        cost: 0,
        toolCalls: 0,
      };
    }
  }

  // ============================================================================
  // Prisma Validation
  // ============================================================================

  /**
   * Validate Prisma schema for syntax and semantic errors
   */
  private async validatePrismaSchema(
    sessionId: string,
    _sandboxPath: string,
  ): Promise<ValidationError[]> {
    try {
      const result = await commandService.executeCommand(
        sessionId,
        'npx prisma validate',
        ValidationCapability.VALIDATION_TIMEOUT_MS,
      );

      if (result.exitCode === 0) {
        return []; // No errors
      }

      // Extract and parse error details
      const errorOutput = result.stderr || result.stdout;
      const parsedErrors = this.parsePrismaErrors(errorOutput);

      return parsedErrors.map((err) => ({
        type: 'prisma' as const,
        file: 'prisma/schema.prisma',
        message: err.message,
        line: err.line,
      }));
    } catch (error) {
      this.logger.error(
        { sessionId, error: getErrorMessage(error) },
        'Error running Prisma validation',
      );
      return [
        {
          type: 'prisma' as const,
          file: 'prisma/schema.prisma',
          message: `Error running Prisma validation: ${getErrorMessage(error)}`,
        },
      ];
    }
  }

  /**
   * Parse Prisma validation errors into structured format
   */
  private parsePrismaErrors(output: string): Array<{
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

  // ============================================================================
  // TypeScript Validation
  // ============================================================================

  /**
   * Validate TypeScript code for type errors (client + server)
   */
  private async validateTypeScript(
    sessionId: string,
    _sandboxPath: string,
  ): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // Validate client
    const clientErrors = await this.validateTypeScriptTarget(sessionId, 'client');
    errors.push(...clientErrors);

    // Validate server
    const serverErrors = await this.validateTypeScriptTarget(sessionId, 'server');
    errors.push(...serverErrors);

    return errors;
  }

  /**
   * Validate TypeScript for a specific target (client or server)
   */
  private async validateTypeScriptTarget(
    sessionId: string,
    target: 'client' | 'server',
  ): Promise<ValidationError[]> {
    try {
      const result = await commandService.executeCommand(
        sessionId,
        `npx tsc --noEmit --project ${target}/tsconfig.json`,
        ValidationCapability.TYPECHECK_TIMEOUT_MS,
      );

      // Parse TypeScript output (prioritize stdout where TypeScript writes errors)
      const output = result.stdout || result.stderr;
      const parsedErrors = this.parseTypeScriptErrors(output);

      // TypeScript compiler returns 0 if no errors, >0 if errors
      if (parsedErrors.length === 0 && result.exitCode !== 0) {
        // Failed but no errors parsed - include raw output
        return [
          {
            type: 'typescript' as const,
            file: `${target}/`,
            message: `TypeScript validation failed but errors could not be parsed. Raw output:\n${output.substring(0, 500)}`,
          },
        ];
      }

      return parsedErrors.map((err) => ({
        type: 'typescript' as const,
        file: err.file,
        message: err.message,
        line: err.line,
        column: err.column,
        code: err.code,
      }));
    } catch (error) {
      this.logger.error(
        { sessionId, target, error: getErrorMessage(error) },
        'Error running TypeScript validation',
      );
      return [
        {
          type: 'typescript' as const,
          file: `${target}/`,
          message: `Error running TypeScript validation: ${getErrorMessage(error)}`,
        },
      ];
    }
  }

  /**
   * Parse TypeScript compiler errors into structured format
   */
  private parseTypeScriptErrors(output: string): Array<{
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
}
