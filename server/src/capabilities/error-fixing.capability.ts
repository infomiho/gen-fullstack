import { stepCountIs, streamText } from 'ai';
import type {
  CapabilityContext,
  CapabilityResult,
  ClientToServerEvents,
  ServerToClientEvents,
} from '../types/index.js';
import type { Server as SocketIOServer } from 'socket.io';
import { BaseCapability } from './base.capability.js';
import type { ModelName } from '../services/llm.service.js';
import { createFixPrompt } from '../config/prompt-snippets.js';
import { parsePrismaErrors } from '../lib/prisma-error-parser.js';
import {
  formatTypeScriptErrorsForLLM,
  type TypeScriptError,
} from '../lib/typescript-error-parser.js';
import { tools } from '../tools/index.js';
import { calculateCost } from '../services/llm.service.js';

/**
 * Error Fixing Capability
 *
 * Automatically fixes compiler errors by sending focused prompts to the LLM.
 * Supports both Prisma schema errors and TypeScript compilation errors.
 *
 * Features:
 * - Focused error fixing prompts (no full regeneration)
 * - Configurable iteration limits
 * - Re-validation after each fix attempt
 * - Detailed progress tracking
 */
export class ErrorFixingCapability extends BaseCapability {
  private maxIterations: number;
  private toolCallsPerIteration: number;

  constructor(
    modelName: ModelName,
    io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
    options: {
      maxIterations?: number;
      toolCallsPerIteration?: number;
    } = {},
  ) {
    super(modelName, io);
    this.maxIterations = options.maxIterations ?? 3;
    this.toolCallsPerIteration = options.toolCallsPerIteration ?? 5;
  }

  getName(): string {
    return 'ErrorFixing';
  }

  /**
   * Check if this capability can be skipped
   * Skip if validation passed with no errors
   */
  canSkip(context: CapabilityContext): boolean {
    const { validation } = context;

    if (!validation) {
      // No validation results - skip error fixing
      return true;
    }

    // Skip if both validations passed
    const schemaOk = validation.schemaValidationPassed ?? true;
    const typesOk = validation.typeCheckPassed ?? true;

    return schemaOk && typesOk;
  }

  /**
   * Validate context requirements for error fixing capability
   * Requires validation results to know what to fix
   */
  validateContext(context: CapabilityContext): void {
    if (!context.validation) {
      throw new Error(
        'ErrorFixingCapability requires context.validation to be populated by ValidationCapability',
      );
    }
    if (!context.sandboxPath) {
      throw new Error('ErrorFixingCapability requires context.sandboxPath to execute fix commands');
    }
  }

  async execute(context: CapabilityContext): Promise<CapabilityResult> {
    const { sessionId, validation } = context;

    if (!validation) {
      return {
        success: true,
        toolCalls: 0,
        contextUpdates: {
          refinementIterations: 0,
        },
      };
    }

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCost = 0;
    let totalToolCalls = 0;
    let iterationCount = 0;

    // Track updated validation state (do NOT mutate context directly)
    let schemaValidationPassed = validation.schemaValidationPassed ?? true;
    let typeCheckPassed = validation.typeCheckPassed ?? true;
    let remainingErrors = validation.errors ?? [];

    try {
      // ==================== FIX SCHEMA ERRORS ====================
      if (validation.schemaValidationPassed === false) {
        this.emitStatus('Fixing Prisma schema errors...', context);

        const fixResult = await this.fixSchemaErrors(context);

        totalInputTokens += fixResult.tokensUsed?.input ?? 0;
        totalOutputTokens += fixResult.tokensUsed?.output ?? 0;
        totalCost += fixResult.cost ?? 0;
        totalToolCalls += fixResult.toolCalls ?? 0;

        if (fixResult.success) {
          // Update local validation state (will be returned via contextUpdates)
          schemaValidationPassed = true;
        }
      }

      // ==================== FIX TYPESCRIPT ERRORS ====================
      if (
        validation.typeCheckPassed === false &&
        validation.errors &&
        validation.errors.length > 0
      ) {
        let tsErrors = validation.errors;

        while (tsErrors.length > 0 && iterationCount < this.maxIterations) {
          iterationCount++;

          this.emitStatus(
            `Fixing TypeScript errors (iteration ${iterationCount}/${this.maxIterations}, ${tsErrors.length} error${tsErrors.length === 1 ? '' : 's'})...`,
            context,
          );

          const fixResult = await this.fixTypeScriptErrors(context, tsErrors);

          totalInputTokens += fixResult.tokensUsed?.input ?? 0;
          totalOutputTokens += fixResult.tokensUsed?.output ?? 0;
          totalCost += fixResult.cost ?? 0;
          totalToolCalls += fixResult.toolCalls ?? 0;

          // Re-validate TypeScript
          const newErrors = await this.validateTypeScript(sessionId);
          tsErrors = newErrors;

          if (tsErrors.length === 0) {
            this.emitStatus('✅ All TypeScript errors fixed', context);
            // Update local validation state (will be returned via contextUpdates)
            typeCheckPassed = true;
            remainingErrors = [];
            break;
          } else if (iterationCount >= this.maxIterations) {
            this.emitStatus(
              `⚠️ Reached max iterations (${this.maxIterations}). ${tsErrors.length} error${tsErrors.length === 1 ? '' : 's'} remaining.`,
              context,
            );
            // Update local validation state (will be returned via contextUpdates)
            remainingErrors = tsErrors;
          }
        }
      }

      this.logger.info(
        {
          sessionId,
          iterations: iterationCount,
          totalInputTokens,
          totalOutputTokens,
          totalCost,
          totalToolCalls,
        },
        'Error fixing completed',
      );

      return {
        success: true,
        tokensUsed: {
          input: totalInputTokens,
          output: totalOutputTokens,
        },
        cost: totalCost,
        toolCalls: totalToolCalls,
        contextUpdates: {
          refinementIterations: iterationCount,
          // Return updated validation state (do NOT mutate context directly)
          validation: {
            schemaValidationPassed,
            typeCheckPassed,
            errors: remainingErrors,
          },
        },
      };
    } catch (error) {
      const errorMessage = `Error fixing capability failed: ${error instanceof Error ? error.message : String(error)}`;
      this.logger.error({ error, sessionId }, errorMessage);

      return {
        success: false,
        error: errorMessage,
        toolCalls: totalToolCalls,
        contextUpdates: {
          refinementIterations: iterationCount,
          // Return updated validation state even on error
          validation: {
            schemaValidationPassed,
            typeCheckPassed,
            errors: remainingErrors,
          },
        },
      };
    }
  }

  /**
   * Fix Prisma schema errors
   */
  private async fixSchemaErrors(context: CapabilityContext): Promise<CapabilityResult> {
    const { sessionId, abortSignal } = context;

    // Get current schema errors
    const { executeCommand } = await import('../services/command.service.js');
    const validateResult = await executeCommand(sessionId, 'npx prisma validate', 60000);

    if (validateResult.success) {
      // Schema is already valid
      return {
        success: true,
        toolCalls: 0,
      };
    }

    const errors = parsePrismaErrors(validateResult.stderr);

    // Emit errors to UI
    const errorList = errors.map((e, i) => `${i + 1}. ${e}`).join('\n');
    this.emitStatus(`Prisma Schema Errors:\n${errorList}`, context);

    // Build fix prompt
    const fixPrompt = `The following Prisma schema validation errors were found:\n\n${errors.join('\n')}\n\nPlease fix these errors in the schema file.`;

    const systemPrompt = createFixPrompt(
      'Prisma schema validation',
      'A Prisma schema was generated but has validation errors.',
      'Fix ONLY the errors in prisma/schema.prisma.',
      [
        'Invalid field types',
        'Missing relation fields',
        'Incorrect syntax',
        'Invalid model names or constraints',
      ],
    );

    // Stream fix with tools
    const result = streamText({
      model: this.model,
      system: systemPrompt,
      prompt: fixPrompt,
      tools,
      experimental_context: { sessionId, io: this.io },
      stopWhen: stepCountIs(this.toolCallsPerIteration),
      onStepFinish: this.createOnStepFinishHandler(sessionId),
      abortSignal,
    });

    // Process stream
    for await (const part of result.fullStream) {
      if (part.type === 'text-delta' && part.text) {
        this.emitMessage('assistant', part.text, sessionId);
      }
    }

    // Get metrics
    const [usage, steps] = await Promise.all([result.usage, result.steps]);
    const inputTokens = usage.inputTokens || 0;
    const outputTokens = usage.outputTokens || 0;
    const cost = calculateCost(this.modelName, inputTokens, outputTokens);

    // Re-validate
    const retryResult = await executeCommand(sessionId, 'npx prisma validate', 60000);
    const success = retryResult.success;

    if (success) {
      // Generate Prisma client
      await executeCommand(sessionId, 'npx prisma generate', 60000);
      this.emitStatus('✅ Schema validation passed', context);
    } else {
      this.emitStatus('⚠️ Schema still has errors after fix attempt', context);
    }

    return {
      success,
      tokensUsed: {
        input: inputTokens,
        output: outputTokens,
      },
      cost,
      toolCalls: steps?.length || 0,
    };
  }

  /**
   * Fix TypeScript errors
   */
  private async fixTypeScriptErrors(
    context: CapabilityContext,
    errors: TypeScriptError[],
  ): Promise<CapabilityResult> {
    const { sessionId, abortSignal } = context;

    const fixPrompt = formatTypeScriptErrorsForLLM(errors);

    // Emit errors to UI
    this.emitStatus(`TypeScript Errors:\n${fixPrompt}`, context);

    const systemPrompt = createFixPrompt(
      'TypeScript compilation',
      'The application was generated but has TypeScript compilation errors.',
      `Fix the TypeScript errors by updating the relevant files.

**CRITICAL RULES:**
1. DO NOT delete working code to fix import errors
2. DO NOT replace Express/Prisma implementations with stubs
3. For "Cannot find module" errors (TS2307):
   - Dependencies are already installed
   - Check if the import path is correct
   - Verify the package is listed in package.json
   - DO NOT remove the import or delete the code using it
4. For type errors: Add proper type annotations or fix type mismatches
5. For config errors: Update tsconfig.json if needed

Focus on minimal, surgical fixes that preserve all functionality.`,
      [
        'Missing imports or incorrect import paths',
        'Incorrect types from Prisma Client (@prisma/client)',
        'Props type mismatches in React components',
        'Async/await issues',
        'Missing type annotations (implicit any)',
      ],
    );

    // Stream fix with tools
    const result = streamText({
      model: this.model,
      system: systemPrompt,
      prompt: fixPrompt,
      tools,
      experimental_context: { sessionId, io: this.io },
      stopWhen: stepCountIs(this.toolCallsPerIteration),
      onStepFinish: this.createOnStepFinishHandler(sessionId),
      abortSignal,
    });

    // Process stream
    for await (const part of result.fullStream) {
      if (part.type === 'text-delta' && part.text) {
        this.emitMessage('assistant', part.text, sessionId);
      }
    }

    // Get metrics
    const [usage, steps] = await Promise.all([result.usage, result.steps]);
    const inputTokens = usage.inputTokens || 0;
    const outputTokens = usage.outputTokens || 0;
    const cost = calculateCost(this.modelName, inputTokens, outputTokens);

    return {
      success: true,
      tokensUsed: {
        input: inputTokens,
        output: outputTokens,
      },
      cost,
      toolCalls: steps?.length || 0,
    };
  }

  /**
   * Validate TypeScript in both workspaces
   */
  private async validateTypeScript(sessionId: string): Promise<TypeScriptError[]> {
    const { validateTypeScript } = await import('../lib/typescript-validator.js');
    return validateTypeScript(sessionId);
  }

  /**
   * Create onStepFinish handler for tool call tracking
   */
  private createOnStepFinishHandler(sessionId: string) {
    // biome-ignore lint/suspicious/noExplicitAny: AI SDK types
    return ({ toolCalls, toolResults }: { toolCalls: any[]; toolResults: any[] }) => {
      for (const toolCall of toolCalls) {
        const toolInput =
          typeof toolCall.input === 'object' && toolCall.input !== null
            ? (toolCall.input as Record<string, unknown>)
            : {};

        this.emitToolCall(toolCall.toolCallId, toolCall.toolName, toolInput, sessionId);
      }

      for (const toolResult of toolResults) {
        const result =
          typeof toolResult.output === 'string'
            ? toolResult.output
            : JSON.stringify(toolResult.output);

        this.emitToolResult(toolResult.toolCallId, toolResult.toolName, result, sessionId);
      }
    };
  }
}
