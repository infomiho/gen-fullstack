import type { Server as SocketIOServer } from 'socket.io';
import {
  type BaseCapability,
  CodeGenerationCapability,
  ErrorFixingCapability,
  PlanningCapability,
  TemplateCapability,
  ValidationCapability,
} from '../capabilities/index.js';
import { getErrorMessage, isAbortError } from '../lib/error-utils.js';
import { createLogger } from '../lib/logger.js';
import { databaseService } from '../services/database.service.js';
import { initializeSandbox } from '../services/filesystem.service.js';
import type { ModelName } from '../services/llm.service.js';
import type {
  CapabilityConfig,
  CapabilityContext,
  CapabilityResult,
  ClientToServerEvents,
  GenerationMetrics,
  GenerationStatus,
  ServerToClientEvents,
} from '../types/index.js';

/**
 * Capability Orchestrator
 *
 * Composes and executes capabilities based on configuration.
 * This is the heart of the new composable generation system.
 *
 * Features:
 * - Builds capability pipeline from config
 * - Passes context between capabilities
 * - Aggregates metrics across all capabilities
 * - Handles errors and abort signals
 * - Updates database with final metrics
 */
export class CapabilityOrchestrator {
  // Constants
  private static readonly DEFAULT_TOOL_CALL_LIMIT = 20;
  private static readonly ERROR_FIXING_TOOL_CALLS_PER_ITERATION = 5;
  private static readonly DEFAULT_MAX_ITERATIONS = 3;
  private static readonly DEFAULT_TEMPLATE_NAME = 'vite-fullstack-base';

  private modelName: ModelName;
  private io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>;
  private logger: ReturnType<typeof createLogger>;
  private abortController: AbortController;

  constructor(
    modelName: ModelName,
    io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  ) {
    this.modelName = modelName;
    this.io = io;
    this.abortController = new AbortController();
    this.logger = createLogger({ service: 'orchestrator' });
  }

  /**
   * Get the abort signal for this generation
   */
  getAbortSignal(): AbortSignal {
    return this.abortController.signal;
  }

  /**
   * Abort the ongoing generation
   */
  abort(): void {
    this.abortController.abort();
  }

  /**
   * Check if generation was aborted
   */
  isAborted(): boolean {
    return this.abortController.signal.aborted;
  }

  /**
   * Generate an app using the capability-based system
   *
   * @param prompt - User's app description
   * @param config - Capability configuration
   * @param sessionId - Unique session identifier
   * @returns Generation metrics
   */
  async generateApp(
    prompt: string,
    config: CapabilityConfig,
    sessionId: string,
  ): Promise<GenerationMetrics> {
    this.logger.info(
      {
        sessionId,
        config,
        modelName: this.modelName,
      },
      'Starting capability-based generation',
    );

    try {
      // 1. Initialize sandbox on host filesystem
      const sandboxPath = await initializeSandbox(sessionId);

      // 2. Create Docker container immediately (execution sandbox)
      this.logger.info({ sessionId }, 'Creating Docker container');
      const { dockerService } = await import('../services/docker.service.js');
      await dockerService.createContainer(sessionId, sandboxPath);
      this.logger.info({ sessionId }, 'Docker container created with status: ready');

      // 3. Build capability pipeline
      const capabilities = this.buildPipeline(config);

      this.logger.info(
        {
          sessionId,
          capabilityCount: capabilities.length,
          capabilityNames: capabilities.map((c) => c.getName()),
        },
        'Built capability pipeline',
      );

      // 4. Initialize context and execute pipeline
      const context = this.initializeContext(sessionId, prompt, sandboxPath);
      const executionResult = await this.executePipeline(capabilities, context);

      if (executionResult) {
        return executionResult; // Early return on failure
      }

      // Success path - container stays in 'ready' status
      return await this.finalizeGeneration(context);
    } catch (error) {
      // Cleanup container on error
      try {
        const { dockerService } = await import('../services/docker.service.js');
        if (dockerService.hasContainer(sessionId)) {
          await dockerService.destroyContainer(sessionId);
        }
      } catch (cleanupError) {
        this.logger.error({ cleanupError, sessionId }, 'Failed to cleanup container after error');
      }

      return await this.handleGenerationError(error, sessionId);
    }
  }

  /**
   * Initialize capability context
   */
  private initializeContext(
    sessionId: string,
    prompt: string,
    sandboxPath: string,
  ): CapabilityContext {
    return {
      sessionId,
      prompt,
      sandboxPath,
      tokens: {
        input: 0,
        output: 0,
        total: 0,
      },
      cost: 0,
      toolCalls: 0,
      startTime: Date.now(),
      abortSignal: this.abortController.signal,
    };
  }

  /**
   * Execute the capability pipeline
   * @returns Metrics if failed early, undefined if successful
   */
  private async executePipeline(
    capabilities: BaseCapability[],
    context: CapabilityContext,
  ): Promise<GenerationMetrics | undefined> {
    for (const capability of capabilities) {
      // Check for abort
      if (this.isAborted()) {
        this.logger.info(
          { sessionId: context.sessionId },
          'Generation aborted during capability execution',
        );
        break;
      }

      // Skip if capability can be skipped
      if (capability.canSkip(context)) {
        this.logger.info(
          { sessionId: context.sessionId, capability: capability.getName() },
          'Skipping capability',
        );
        continue;
      }

      // Validate and execute capability
      const validationError = this.validateCapability(capability, context);
      if (validationError) {
        return await this.handleValidationError(capability, validationError, context);
      }

      this.logger.info(
        { sessionId: context.sessionId, capability: capability.getName() },
        'Executing capability',
      );

      const result = await capability.execute(context);
      this.updateContextFromResult(context, result);

      // Check if capability failed
      if (!result.success) {
        const errorMsg = result.error ?? 'Capability failed without error message';
        return await this.handleExecutionError(capability, errorMsg, context);
      }
    }

    return undefined; // Success
  }

  /**
   * Validate capability context requirements
   * @returns Error message if validation fails, undefined if successful
   */
  private validateCapability(
    capability: BaseCapability,
    context: CapabilityContext,
  ): string | undefined {
    try {
      capability.validateContext(context);
      return undefined;
    } catch (error) {
      const errorMsg = getErrorMessage(error);
      this.logger.error(
        { sessionId: context.sessionId, capability: capability.getName(), error: errorMsg },
        'Context validation failed',
      );
      return errorMsg;
    }
  }

  /**
   * Update context with capability execution results
   * @mutates context - Modifies context in place for performance
   */
  private updateContextFromResult(
    mutableContext: CapabilityContext,
    result: CapabilityResult,
  ): void {
    // Update token usage with nullish coalescing
    mutableContext.tokens.input += result.tokensUsed?.input ?? 0;
    mutableContext.tokens.output += result.tokensUsed?.output ?? 0;
    mutableContext.tokens.total = mutableContext.tokens.input + mutableContext.tokens.output;

    mutableContext.cost += result.cost ?? 0;
    mutableContext.toolCalls += result.toolCalls ?? 0;

    // Merge context updates (explicit fields only for type safety)
    if (result.contextUpdates?.plan !== undefined) {
      mutableContext.plan = result.contextUpdates.plan;
    }
    if (result.contextUpdates?.templateFiles !== undefined) {
      mutableContext.templateFiles = result.contextUpdates.templateFiles;
    }
    if (result.contextUpdates?.validation !== undefined) {
      mutableContext.validation = result.contextUpdates.validation;
    }
    if (result.contextUpdates?.refinementIterations !== undefined) {
      mutableContext.refinementIterations = result.contextUpdates.refinementIterations;
    }
  }

  /**
   * Handle capability validation error
   */
  private async handleValidationError(
    capability: BaseCapability,
    errorMsg: string,
    context: CapabilityContext,
  ): Promise<GenerationMetrics> {
    this.logger.error(
      { sessionId: context.sessionId, capability: capability.getName(), error: errorMsg },
      'Capability context validation failed',
    );

    this.io
      .to(context.sessionId)
      .emit('error', `${capability.getName()} context validation failed: ${errorMsg}`);

    const metrics = this.buildMetrics(context, 'failed');
    const dbSuccess = await this.updateDatabase(context.sessionId, metrics, 'failed', errorMsg);

    if (!dbSuccess) {
      this.io.to(context.sessionId).emit('warning', 'Metrics may not be persisted');
    }

    this.emitComplete(context.sessionId, metrics, 'failed');
    return metrics;
  }

  /**
   * Handle capability execution error
   */
  private async handleExecutionError(
    capability: BaseCapability,
    errorMsg: string,
    context: CapabilityContext,
  ): Promise<GenerationMetrics> {
    this.logger.error(
      { sessionId: context.sessionId, capability: capability.getName(), error: errorMsg },
      'Capability execution failed',
    );

    this.io.to(context.sessionId).emit('error', `${capability.getName()} failed: ${errorMsg}`);

    const metrics = this.buildMetrics(context, 'failed');
    const dbSuccess = await this.updateDatabase(context.sessionId, metrics, 'failed', errorMsg);

    if (!dbSuccess) {
      this.io.to(context.sessionId).emit('warning', 'Metrics may not be persisted');
    }

    this.emitComplete(context.sessionId, metrics, 'failed');
    return metrics;
  }

  /**
   * Finalize generation with success or cancellation
   */
  private async finalizeGeneration(context: CapabilityContext): Promise<GenerationMetrics> {
    const status: GenerationStatus = this.isAborted() ? 'cancelled' : 'completed';
    const metrics = this.buildMetrics(context, status);

    this.logger.info(
      {
        sessionId: context.sessionId,
        metrics,
      },
      `Generation ${status}`,
    );

    const dbSuccess = await this.updateDatabase(context.sessionId, metrics, status);
    if (!dbSuccess) {
      this.io.to(context.sessionId).emit('warning', 'Metrics may not be persisted');
    }

    this.emitComplete(context.sessionId, metrics, status);
    return metrics;
  }

  /**
   * Handle top-level generation errors
   */
  private async handleGenerationError(
    error: unknown,
    sessionId: string,
  ): Promise<GenerationMetrics> {
    const duration = Date.now();

    // Check if error is due to abort (cancellation)
    if (isAbortError(error) || this.isAborted()) {
      const metrics = this.createEmptyMetrics(sessionId, duration);
      await this.updateDatabase(sessionId, metrics, 'cancelled');
      this.emitComplete(sessionId, metrics, 'cancelled');
      return metrics;
    }

    // Regular error handling
    const errorMsg = getErrorMessage(error);
    this.logger.error({ error, sessionId }, 'Generation failed with error');

    this.io.to(sessionId).emit('error', errorMsg);

    const metrics = this.createEmptyMetrics(sessionId, duration);
    const dbSuccess = await this.updateDatabase(sessionId, metrics, 'failed', errorMsg);

    if (!dbSuccess) {
      this.io.to(sessionId).emit('warning', 'Metrics may not be persisted');
    }

    this.emitComplete(sessionId, metrics, 'failed');
    return metrics;
  }

  /**
   * Create empty metrics for error/cancellation cases
   */
  private createEmptyMetrics(sessionId: string, duration: number): GenerationMetrics {
    return {
      sessionId,
      model: this.modelName,
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      duration,
      steps: 0,
    };
  }

  /**
   * Build capability pipeline based on configuration
   *
   * The pipeline is built from three independent dimensions:
   * 1. Planning (optional): Generate architectural plan
   * 2. Input Mode: Template or Naive code generation
   * 3. Compiler Checks (optional): Validate and fix errors
   */
  private buildPipeline(config: CapabilityConfig): BaseCapability[] {
    const capabilities: BaseCapability[] = [];

    // Step 1: Planning (if enabled)
    if (config.planning) {
      capabilities.push(new PlanningCapability(this.modelName, this.io));
    }

    // Step 2: Input capability (template vs naive)
    switch (config.inputMode) {
      case 'template':
        capabilities.push(
          new TemplateCapability(
            this.modelName,
            this.io,
            config.templateOptions?.templateName ?? CapabilityOrchestrator.DEFAULT_TEMPLATE_NAME,
          ),
        );
        capabilities.push(
          new CodeGenerationCapability(
            this.modelName,
            this.io,
            config.planning ? 'template-plan-based' : 'template',
            CapabilityOrchestrator.DEFAULT_TOOL_CALL_LIMIT,
            config,
          ),
        );
        break;

      case 'naive':
        capabilities.push(
          new CodeGenerationCapability(
            this.modelName,
            this.io,
            config.planning ? 'plan-based' : 'naive',
            CapabilityOrchestrator.DEFAULT_TOOL_CALL_LIMIT,
            config,
          ),
        );
        break;

      default: {
        // Exhaustiveness check - TypeScript will error if new modes are added
        const _exhaustive: never = config.inputMode;
        throw new Error(`Unknown input mode: ${String(_exhaustive)}`);
      }
    }

    // Step 3: Compiler checks (if enabled)
    if (config.compilerChecks) {
      // Validation always runs first
      capabilities.push(
        new ValidationCapability(this.modelName, this.io, {
          validateSchema: true,
          validateTypeScript: true,
        }),
      );

      // Then error fixing
      capabilities.push(
        new ErrorFixingCapability(this.modelName, this.io, {
          maxIterations: config.maxIterations ?? CapabilityOrchestrator.DEFAULT_MAX_ITERATIONS,
          toolCallsPerIteration: CapabilityOrchestrator.ERROR_FIXING_TOOL_CALLS_PER_ITERATION,
        }),
      );
    }

    return capabilities;
  }

  /**
   * Build final generation metrics from context
   */
  private buildMetrics(context: CapabilityContext, status: GenerationStatus): GenerationMetrics {
    const duration = this.calculateDuration(context);

    const metrics: GenerationMetrics = {
      sessionId: context.sessionId,
      model: this.modelName,
      status,
      totalTokens: context.tokens.total,
      inputTokens: context.tokens.input,
      outputTokens: context.tokens.output,
      cost: context.cost,
      duration,
      steps: context.toolCalls,
    };

    // Add compiler metrics if available
    if (context.validation) {
      metrics.schemaValidationPassed = context.validation.schemaValidationPassed;
      metrics.typeCheckPassed = context.validation.typeCheckPassed;
      metrics.totalCompilerErrors = context.validation.errors?.length ?? 0;
    }

    if (context.refinementIterations !== undefined) {
      metrics.compilerIterations = context.refinementIterations;
    }

    return metrics;
  }

  /**
   * Calculate duration from context start time
   */
  private calculateDuration(context: CapabilityContext): number {
    return Date.now() - context.startTime;
  }

  /**
   * Update database with final metrics
   * @returns True if update succeeded, false if it failed
   */
  private async updateDatabase(
    sessionId: string,
    metrics: GenerationMetrics,
    status: GenerationStatus,
    errorMessage?: string,
  ): Promise<boolean> {
    try {
      await databaseService.updateSession(sessionId, {
        status,
        completedAt: new Date(),
        inputTokens: metrics.inputTokens,
        outputTokens: metrics.outputTokens,
        totalTokens: metrics.totalTokens,
        cost: metrics.cost.toString(),
        durationMs: metrics.duration,
        stepCount: metrics.steps,
        ...(errorMessage && { errorMessage }),
      });
      return true;
    } catch (error) {
      this.logger.error({ error, sessionId }, 'Failed to update database');
      return false;
    }
  }

  /**
   * Emit generation complete event
   */
  private emitComplete(
    sessionId: string,
    metrics: GenerationMetrics,
    status: GenerationStatus,
  ): void {
    this.io.to(sessionId).emit('generation_complete', {
      ...metrics,
      status,
    });
  }
}
