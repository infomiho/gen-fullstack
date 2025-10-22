import { stepCountIs, streamText } from 'ai';
import type { Server as SocketIOServer } from 'socket.io';
import { createFixPrompt } from '../config/prompt-snippets.js';
import { getErrorMessage } from '../lib/error-utils.js';
import { parsePrismaErrors } from '../lib/prisma-error-parser.js';
import {
  formatTypeScriptErrorsForLLM,
  type TypeScriptError,
} from '../lib/typescript-error-parser.js';
import type { ModelName } from '../services/llm.service.js';
import { calculateCost } from '../services/llm.service.js';
import { tools } from '../tools/index.js';
import type {
  CapabilityContext,
  CapabilityResult,
  ClientToServerEvents,
  ServerToClientEvents,
} from '../types/index.js';
import { BaseCapability } from './base.capability.js';

/**
 * Metrics tracker for error fixing iterations
 */
interface MetricsTracker {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  totalToolCalls: number;
  iterationCount: number;
}

/**
 * Validation state during error fixing
 */
interface ValidationState {
  schemaValidationPassed: boolean;
  typeCheckPassed: boolean;
  remainingErrors: TypeScriptError[];
}

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
    this.maxIterations = options.maxIterations ?? BaseCapability.DEFAULT_MAX_ITERATIONS;
    this.toolCallsPerIteration =
      options.toolCallsPerIteration ?? BaseCapability.TOOL_CALLS_PER_FIX_ITERATION;
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
    const { validation } = context;

    if (!validation) {
      return this.createSkippedResult();
    }

    const metrics = this.createMetricsTracker();
    const validationState = this.initializeValidationState(validation);

    try {
      // Fix schema errors if needed
      if (validation.schemaValidationPassed === false) {
        await this.handleSchemaErrors(context, metrics, validationState);
      }

      // Fix TypeScript errors if needed
      if (this.hasTypeScriptErrors(validation)) {
        await this.handleTypeScriptErrors(context, metrics, validationState);
      }

      return this.createSuccessResult(context, metrics, validationState);
    } catch (error) {
      return this.createErrorResult(context, error, metrics, validationState);
    }
  }

  private createSkippedResult(): CapabilityResult {
    return {
      success: true,
      toolCalls: 0,
      contextUpdates: {
        refinementIterations: 0,
      },
    };
  }

  private createMetricsTracker(): MetricsTracker {
    return {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
      totalToolCalls: 0,
      iterationCount: 0,
    };
  }

  private initializeValidationState(validation: CapabilityContext['validation']): ValidationState {
    return {
      schemaValidationPassed: validation?.schemaValidationPassed ?? true,
      typeCheckPassed: validation?.typeCheckPassed ?? true,
      remainingErrors: validation?.errors ?? [],
    };
  }

  private hasTypeScriptErrors(validation: CapabilityContext['validation']): boolean {
    return (
      validation?.typeCheckPassed === false &&
      validation.errors !== undefined &&
      validation.errors.length > 0
    );
  }

  private async handleSchemaErrors(
    context: CapabilityContext,
    metrics: MetricsTracker,
    validationState: ValidationState,
  ) {
    this.emitStatus('Fixing Prisma schema errors...', context);
    const fixResult = await this.fixSchemaErrors(context);

    this.updateMetrics(metrics, fixResult);

    if (fixResult.success) {
      validationState.schemaValidationPassed = true;
    }
  }

  private async handleTypeScriptErrors(
    context: CapabilityContext,
    metrics: MetricsTracker,
    validationState: ValidationState,
  ) {
    const { sessionId, validation } = context;
    let tsErrors = validation?.errors ?? [];

    while (tsErrors.length > 0 && metrics.iterationCount < this.maxIterations) {
      metrics.iterationCount++;

      this.emitStatus(
        `Fixing TypeScript errors (iteration ${metrics.iterationCount}/${this.maxIterations}, ${tsErrors.length} error${tsErrors.length === 1 ? '' : 's'})...`,
        context,
      );

      const fixResult = await this.fixTypeScriptErrors(context, tsErrors);
      this.updateMetrics(metrics, fixResult);

      // Re-validate TypeScript
      tsErrors = await this.validateTypeScript(sessionId);

      if (tsErrors.length === 0) {
        this.emitStatus('✅ All TypeScript errors fixed', context);
        validationState.typeCheckPassed = true;
        validationState.remainingErrors = [];
        break;
      }

      if (metrics.iterationCount >= this.maxIterations) {
        this.emitStatus(
          `⚠️ Reached max iterations (${this.maxIterations}). ${tsErrors.length} error${tsErrors.length === 1 ? '' : 's'} remaining.`,
          context,
        );
        validationState.remainingErrors = tsErrors;
      }
    }
  }

  private updateMetrics(
    metrics: MetricsTracker,
    fixResult: {
      tokensUsed?: { input: number; output: number };
      cost?: number;
      toolCalls?: number;
    },
  ) {
    metrics.totalInputTokens += fixResult.tokensUsed?.input ?? 0;
    metrics.totalOutputTokens += fixResult.tokensUsed?.output ?? 0;
    metrics.totalCost += fixResult.cost ?? 0;
    metrics.totalToolCalls += fixResult.toolCalls ?? 0;
  }

  private createSuccessResult(
    context: CapabilityContext,
    metrics: MetricsTracker,
    validationState: ValidationState,
  ): CapabilityResult {
    this.logger.info(
      {
        sessionId: context.sessionId,
        iterations: metrics.iterationCount,
        totalInputTokens: metrics.totalInputTokens,
        totalOutputTokens: metrics.totalOutputTokens,
        totalCost: metrics.totalCost,
        totalToolCalls: metrics.totalToolCalls,
      },
      'Error fixing completed',
    );

    return {
      success: true,
      tokensUsed: {
        input: metrics.totalInputTokens,
        output: metrics.totalOutputTokens,
      },
      cost: metrics.totalCost,
      toolCalls: metrics.totalToolCalls,
      contextUpdates: {
        refinementIterations: metrics.iterationCount,
        validation: {
          schemaValidationPassed: validationState.schemaValidationPassed,
          typeCheckPassed: validationState.typeCheckPassed,
          errors: validationState.remainingErrors,
        },
      },
    };
  }

  private createErrorResult(
    context: CapabilityContext,
    error: unknown,
    metrics: MetricsTracker,
    validationState: ValidationState,
  ): CapabilityResult {
    const errorMessage = `Error fixing capability failed: ${getErrorMessage(error)}`;
    this.logger.error({ error, sessionId: context.sessionId }, errorMessage);

    return {
      success: false,
      error: errorMessage,
      toolCalls: metrics.totalToolCalls,
      contextUpdates: {
        refinementIterations: metrics.iterationCount,
        validation: {
          schemaValidationPassed: validationState.schemaValidationPassed,
          typeCheckPassed: validationState.typeCheckPassed,
          errors: validationState.remainingErrors,
        },
      },
    };
  }

  /**
   * Fix Prisma schema errors
   */
  private async fixSchemaErrors(context: CapabilityContext): Promise<CapabilityResult> {
    const { sessionId, abortSignal } = context;

    // Get current schema errors
    const { executeCommand } = await import('../services/command.service.js');
    const validateResult = await executeCommand(
      sessionId,
      'npx prisma validate',
      BaseCapability.COMMAND_TIMEOUT_MS,
    );

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
      'Fix the errors in prisma/schema.prisma. IMPORTANT: Prisma relation errors often require adding corresponding fields to BOTH models in the relationship. For example, if GameSession.host references Player with @relation("SessionHost"), you must add a hostedSessions field to Player with the same relation name.',
      [
        'Invalid field types',
        'Missing relation fields - requires adding opposite relation field to related model',
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
    const retryResult = await executeCommand(
      sessionId,
      'npx prisma validate',
      BaseCapability.COMMAND_TIMEOUT_MS,
    );
    const success = retryResult.success;

    if (success) {
      // Generate Prisma client
      await executeCommand(sessionId, 'npx prisma generate', BaseCapability.COMMAND_TIMEOUT_MS);
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
   - Check if the package is listed in package.json - if NOT, add it to dependencies
   - You CAN edit package.json to add missing dependencies
   - Check if the import path is correct
   - DO NOT remove the import or delete the code using it
4. For type errors: Add proper type annotations or fix type mismatches
5. For config errors: Update tsconfig.json if needed

**ERROR PRIORITY LEVELS:**
- HIGH PRIORITY (fix first): Errors that prevent compilation
  → TS2307 (Cannot find module) - missing dependencies or wrong paths
  → TS2304 (Cannot find name) - undefined variables
  → TS2322 (Type mismatch) - incorrect types that break functionality
- MEDIUM PRIORITY: Type safety issues
  → TS7006 (implicit any) - add types if straightforward
- LOW PRIORITY: Development warnings (fix if easy, otherwise skip)
  → TS6133 (unused variables) - often false positives during development
  → Unused imports in React 19 (React import not needed with new JSX transform)

Focus on HIGH priority errors first. If you reach tool call limits, it's OK to leave MEDIUM/LOW errors unfixed.

Focus on minimal, surgical fixes that preserve all functionality.`,
      [
        'Missing dependencies in package.json (add them)',
        'Incorrect import paths',
        'Incorrect types from Prisma Client (@prisma/client)',
        'Props type mismatches in React components',
        'Async/await issues',
        'Missing type annotations (implicit any) - lower priority',
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
}
