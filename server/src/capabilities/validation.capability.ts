import { TOOL_NAMES, type ValidationError } from '@gen-fullstack/shared';
import { getErrorMessage } from '../lib/error-utils.js';
import * as commandService from '../services/command.service.js';
import type { CapabilityContext, CapabilityResult } from '../types/index.js';
import { BaseCapability } from './base.capability.js';
import { parsePrismaErrors } from '../lib/prisma-error-parser.js';

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

  /**
   * Execute a validation step with consistent error handling and result emission
   *
   * @param stepName - Name of the validation step (for IDs and logging)
   * @param toolName - Tool name for emission
   * @param toolArgs - Arguments to pass to the tool
   * @param sessionId - Session identifier
   * @param validator - Async function that performs the validation and returns errors
   * @param successMessage - Message to display on success
   * @returns Array of validation errors (empty if successful)
   */
  private async executeValidationStep(
    stepName: string,
    toolName: string,
    toolArgs: Record<string, unknown>,
    sessionId: string,
    validator: () => Promise<ValidationError[]>,
    successMessage: string,
  ): Promise<ValidationError[]> {
    const callId = `${stepName}-${Date.now()}`;

    try {
      this.emitToolCall(callId, toolName, toolArgs, sessionId, `Validate ${stepName}`);

      const errors = await validator();

      const resultMessage =
        errors.length === 0 ? `✓ ${successMessage}` : `✗ Found ${errors.length} error(s)`;

      this.emitToolResult(callId, toolName, resultMessage, sessionId, errors.length > 0);

      return errors;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.emitToolResult(callId, toolName, `Error: ${errorMessage}`, sessionId, true);
      throw error;
    }
  }

  async execute(context: CapabilityContext): Promise<CapabilityResult> {
    this.validateContext(context);

    const { sessionId, sandboxPath } = context;
    const startTime = Date.now();

    // After validation, sandboxPath is guaranteed to be non-null
    const sandboxDir = sandboxPath as string;

    try {
      // Install dependencies (doesn't return ValidationError[], so handle separately)
      await this.executeValidationStep(
        'install-deps',
        'installDependencies',
        { path: sandboxDir },
        sessionId,
        async () => {
          const installResult = await commandService.executeCommand(
            sessionId,
            'npm install',
            180000,
          );

          if (installResult.exitCode !== 0) {
            const errorOutput = installResult.stderr || installResult.stdout;
            throw new Error(`Dependency installation failed: ${errorOutput.substring(0, 200)}`);
          }

          return []; // No validation errors, just success
        },
        'Dependencies installed successfully',
      );

      const errors: ValidationError[] = [];

      // Validate Prisma schema
      const prismaErrors = await this.executeValidationStep(
        'validate-prisma',
        TOOL_NAMES.VALIDATE_PRISMA_SCHEMA,
        { path: `${sandboxDir}/prisma/schema.prisma` },
        sessionId,
        () => this.validatePrismaSchema(sessionId, sandboxDir),
        'Prisma schema validation passed',
      );
      errors.push(...prismaErrors);

      // Validate TypeScript
      const tsErrors = await this.executeValidationStep(
        'validate-typescript',
        TOOL_NAMES.VALIDATE_TYPESCRIPT,
        { clientPath: `${sandboxDir}/client`, serverPath: `${sandboxDir}/server` },
        sessionId,
        () => this.validateTypeScript(sessionId, sandboxDir),
        'TypeScript validation passed',
      );
      errors.push(...tsErrors);

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
        return [];
      }

      const errorOutput = result.stderr || result.stdout;
      const parsedErrors = parsePrismaErrors(errorOutput);

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
