import type { Server as SocketIOServer } from 'socket.io';
import type {
  CapabilityConfig,
  CapabilityContext,
  ClientToServerEvents,
  GenerationMetrics,
  ServerToClientEvents,
} from '../types/index.js';
import { createLogger } from '../lib/logger.js';
import { initializeSandbox } from '../services/filesystem.service.js';
import type { ModelName } from '../services/llm.service.js';
import { databaseService } from '../services/database.service.js';
import {
  type BaseCapability,
  TemplateCapability,
  PlanningCapability,
  CodeGenerationCapability,
  ValidationCapability,
  ErrorFixingCapability,
} from '../capabilities/index.js';

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
    const startTime = Date.now();

    this.logger.info(
      {
        sessionId,
        config,
        modelName: this.modelName,
      },
      'Starting capability-based generation',
    );

    try {
      // Initialize sandbox
      const sandboxPath = await initializeSandbox(sessionId);

      // Build capability pipeline
      const capabilities = this.buildPipeline(config);

      this.logger.info(
        {
          sessionId,
          capabilityCount: capabilities.length,
          capabilityNames: capabilities.map((c) => c.getName()),
        },
        'Built capability pipeline',
      );

      // Initialize context
      const context: CapabilityContext = {
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
        startTime,
        abortSignal: this.abortController.signal,
      };

      // Execute capability pipeline
      for (const capability of capabilities) {
        // Check for abort
        if (this.isAborted()) {
          this.logger.info({ sessionId }, 'Generation aborted during capability execution');
          break;
        }

        // Skip if capability can be skipped
        if (capability.canSkip(context)) {
          this.logger.info({ sessionId, capability: capability.getName() }, 'Skipping capability');
          continue;
        }

        // Validate context requirements before execution
        try {
          capability.validateContext(context);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          this.logger.error(
            { sessionId, capability: capability.getName(), error: errorMsg },
            'Context validation failed',
          );

          // Emit error and return partial metrics
          this.io
            .to(sessionId)
            .emit('error', `${capability.getName()} context validation failed: ${errorMsg}`);

          const duration = Date.now() - startTime;
          const metrics = this.buildMetrics(context, duration, 'failed');

          await this.updateDatabase(sessionId, metrics, 'failed', errorMsg);
          this.emitComplete(sessionId, metrics, 'failed');

          return metrics;
        }

        this.logger.info({ sessionId, capability: capability.getName() }, 'Executing capability');

        // Execute capability
        const result = await capability.execute(context);

        // Update context with results
        if (result.tokensUsed) {
          context.tokens.input += result.tokensUsed.input;
          context.tokens.output += result.tokensUsed.output;
          context.tokens.total = context.tokens.input + context.tokens.output;
        }

        if (result.cost) {
          context.cost += result.cost;
        }

        if (result.toolCalls) {
          context.toolCalls += result.toolCalls;
        }

        // Merge context updates (explicit fields only for type safety)
        if (result.contextUpdates) {
          if (result.contextUpdates.plan !== undefined) {
            context.plan = result.contextUpdates.plan;
          }
          if (result.contextUpdates.templateFiles !== undefined) {
            context.templateFiles = result.contextUpdates.templateFiles;
          }
          if (result.contextUpdates.validation !== undefined) {
            context.validation = result.contextUpdates.validation;
          }
          if (result.contextUpdates.refinementIterations !== undefined) {
            context.refinementIterations = result.contextUpdates.refinementIterations;
          }
        }

        // Check if capability failed
        if (!result.success) {
          const errorMsg = result.error || 'Capability failed without error message';
          this.logger.error(
            { sessionId, capability: capability.getName(), error: errorMsg },
            'Capability execution failed',
          );

          // Emit error and return partial metrics
          this.io.to(sessionId).emit('error', `${capability.getName()} failed: ${errorMsg}`);

          const duration = Date.now() - startTime;
          const metrics = this.buildMetrics(context, duration, 'failed');

          await this.updateDatabase(sessionId, metrics, 'failed', errorMsg);
          this.emitComplete(sessionId, metrics, 'failed');

          return metrics;
        }
      }

      // Calculate final metrics
      const duration = Date.now() - startTime;
      const status = this.isAborted() ? 'cancelled' : 'completed';
      const metrics = this.buildMetrics(context, duration, status);

      this.logger.info(
        {
          sessionId,
          metrics,
        },
        `Generation ${status}`,
      );

      // Update database
      await this.updateDatabase(sessionId, metrics, status);

      // Emit completion event
      this.emitComplete(sessionId, metrics, status);

      return metrics;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Check if error is due to abort (cancellation)
      if (error instanceof Error && (error.name === 'AbortError' || this.isAborted())) {
        const metrics: GenerationMetrics = {
          sessionId,
          model: this.modelName,
          totalTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          cost: 0,
          duration,
          steps: 0,
        };

        await this.updateDatabase(sessionId, metrics, 'cancelled');
        this.emitComplete(sessionId, metrics, 'cancelled');
        return metrics;
      }

      // Regular error handling
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error({ error, sessionId }, 'Generation failed with error');

      this.io.to(sessionId).emit('error', errorMsg);

      const metrics: GenerationMetrics = {
        sessionId,
        model: this.modelName,
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        duration,
        steps: 0,
      };

      await this.updateDatabase(sessionId, metrics, 'failed', errorMsg);
      this.emitComplete(sessionId, metrics, 'failed');

      return metrics;
    }
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
            config.templateOptions?.templateName || 'vite-fullstack-base',
          ),
        );
        capabilities.push(
          new CodeGenerationCapability(
            this.modelName,
            this.io,
            config.planning ? 'template-plan-based' : 'template',
            20,
          ),
        );
        break;

      default:
        // Naive mode
        capabilities.push(
          new CodeGenerationCapability(
            this.modelName,
            this.io,
            config.planning ? 'plan-based' : 'naive',
            20,
          ),
        );
        break;
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
          maxIterations: config.maxIterations ?? 3,
          toolCallsPerIteration: 5,
        }),
      );
    }

    return capabilities;
  }

  /**
   * Build final generation metrics from context
   */
  private buildMetrics(
    context: CapabilityContext,
    duration: number,
    status: 'completed' | 'cancelled' | 'failed',
  ): GenerationMetrics {
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
   * Update database with final metrics
   */
  private async updateDatabase(
    sessionId: string,
    metrics: GenerationMetrics,
    status: 'completed' | 'cancelled' | 'failed',
    errorMessage?: string,
  ): Promise<void> {
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
    } catch (error) {
      this.logger.error({ error, sessionId }, 'Failed to update database');
    }
  }

  /**
   * Emit generation complete event
   */
  private emitComplete(
    sessionId: string,
    metrics: GenerationMetrics,
    status: 'completed' | 'cancelled' | 'failed',
  ): void {
    this.io.to(sessionId).emit('generation_complete', {
      ...metrics,
      status,
    });
  }
}
