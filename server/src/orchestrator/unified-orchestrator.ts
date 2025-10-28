import type { Server as SocketIOServer } from 'socket.io';
import { createActor } from 'xstate';
import { UnifiedCodeGenerationCapability } from '../capabilities/unified-code-generation.capability.js';
import { TemplateCapability } from '../capabilities/template.capability.js';
import { PlanningCapability } from '../capabilities/planning.capability.js';
import { ValidationCapability } from '../capabilities/validation.capability.js';
import { ErrorFixingCapability } from '../capabilities/error-fixing.capability.js';
import { getEnv } from '../config/env.js';
import { getErrorMessage, isAbortError } from '../lib/error-utils.js';
import { createLogger } from '../lib/logger.js';
import { cleanupSession } from '../lib/message-utils.js';
import { databaseService } from '../services/database.service.js';
import { initializeSandbox } from '../services/filesystem.service.js';
import type { ModelName } from '../services/llm.service.js';
import type {
  CapabilityConfig,
  CapabilityContext,
  ClientToServerEvents,
  GenerationMetrics,
  ServerToClientEvents,
} from '../types/index.js';
import {
  createGenerationMachine,
  type GenerationMachineActor,
  type InitializeOutput,
  type InitializeInput,
  type PlanningInput,
  type PlanningOutput,
  type CopyTemplateInput,
  type CodeGenerationInput,
  type CodeGenerationOutput,
  type ValidationInput,
  type ValidationOutput,
  type ErrorFixingInput,
  type ErrorFixingOutput,
  type FinishInput,
} from './generation.machine.js';

/**
 * Unified Capability Orchestrator (XState-driven)
 *
 * Uses an XState state machine to orchestrate the generation pipeline with
 * explicit state management and automatic cleanup.
 *
 * State Machine Flow:
 * idle → initializing → [loadingTemplate]? → codeGenerating → completing → completed/failed/cancelled
 *
 * The orchestrator decides:
 * 1. Whether to copy a template first (inputMode: 'template' vs 'naive')
 * 2. Then runs UnifiedCodeGenerationCapability with all tools available
 *
 * The LLM self-orchestrates via tools:
 * - planArchitecture (if planning is enabled in config)
 * - validatePrismaSchema (if compilerChecks is enabled)
 * - validateTypeScript (if compilerChecks is enabled)
 * - requestBlock (if buildingBlocks is enabled)
 *
 * Design Philosophy:
 * - Explicit state management via XState
 * - Automatic cleanup and timeout handling
 * - LLM decides when to use optional features
 * - Single composable prompt system
 */
export class UnifiedOrchestrator {
  private modelName: ModelName;
  private io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>;
  private logger: ReturnType<typeof createLogger>;
  private abortController: AbortController;
  private generationTimeout?: NodeJS.Timeout;
  // XState machine actor that orchestrates generation
  private actor?: GenerationMachineActor;
  // Track pipeline stage IDs for updates (prevents duplicate cards in UI)
  private stageIds: Map<string, string> = new Map();

  constructor(
    modelName: ModelName,
    io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  ) {
    this.modelName = modelName;
    this.io = io;
    this.abortController = new AbortController();
    this.logger = createLogger({ service: 'unified-orchestrator' });
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
   * Clear the generation timeout (if set)
   */
  private clearGenerationTimeout(): void {
    if (this.generationTimeout) {
      clearTimeout(this.generationTimeout);
      this.generationTimeout = undefined;
    }
  }

  /**
   * Emit a pipeline stage event to the client
   * (Phase B - explicit orchestration UI)
   */
  private emitPipelineStage(
    sessionId: string,
    type: 'planning' | 'validation' | 'template_loading' | 'completing',
    status: 'started' | 'completed' | 'failed',
    data?: {
      plan?: any;
      validationErrors?: any[];
      iteration?: number;
      maxIterations?: number;
      templateName?: string;
      summary?: string;
    },
  ): void {
    // For validation stages with multiple iterations, use unique keys
    const stageKey = type === 'validation' && data?.iteration ? `${type}-${data.iteration}` : type;

    // Get or create stable ID for this stage
    let stageId = this.stageIds.get(stageKey);
    if (!stageId) {
      stageId = `stage-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      this.stageIds.set(stageKey, stageId);
    }

    const event = {
      id: stageId,
      type,
      status,
      timestamp: Date.now(),
      data,
    };

    this.logger.debug({ sessionId, stage: type, status }, 'Emitting pipeline stage event');
    this.io.emit('pipeline_stage', event);
  }

  /**
   * Create and initialize the generation state machine
   *
   * The machine orchestrates the entire generation pipeline.
   */
  private createMachine(
    sessionId: string,
    prompt: string,
    config: CapabilityConfig,
  ): GenerationMachineActor {
    const machine = createGenerationMachine({
      actors: {
        // Initialize sandbox and Docker container
        initializeActor: async (input: InitializeInput): Promise<InitializeOutput> => {
          this.logger.info({ sessionId: input.sessionId }, 'Initializing sandbox and Docker');

          // 1. Initialize sandbox on host filesystem
          const sandboxPath = await initializeSandbox(input.sessionId);

          // 2. Create Docker container immediately (execution sandbox)
          this.logger.info({ sessionId: input.sessionId }, 'Creating Docker container');
          const { dockerService } = await import('../services/docker.service.js');
          await dockerService.createContainer(input.sessionId, sandboxPath);
          this.logger.info(
            { sessionId: input.sessionId },
            'Docker container created with status: ready',
          );

          return { sandboxPath };
        },

        // Copy template files to sandbox
        copyTemplateActor: async (input: CopyTemplateInput): Promise<void> => {
          this.logger.info(
            { sessionId: input.sessionId, templateName: input.templateName },
            'Copying template',
          );

          // Emit template loading started
          this.emitPipelineStage(input.sessionId, 'template_loading', 'started', {
            templateName: input.templateName,
          });

          const capability = new TemplateCapability(this.modelName, this.io, input.templateName);
          const context: CapabilityContext = {
            sessionId: input.sessionId,
            prompt: '', // Not needed for template copy
            sandboxPath: input.sandboxPath,
            tokens: { input: 0, output: 0, total: 0 },
            cost: 0,
            toolCalls: 0,
            startTime: Date.now(),
            abortSignal: this.abortController.signal,
          };

          const result = await capability.execute(context);
          if (!result.success) {
            // Emit template loading failed
            this.emitPipelineStage(input.sessionId, 'template_loading', 'failed', {
              templateName: input.templateName,
            });
            throw new Error(result.error ?? 'Template copy failed');
          }

          this.logger.info({ sessionId: input.sessionId }, 'Template copied successfully');

          // Emit template loading completed
          this.emitPipelineStage(input.sessionId, 'template_loading', 'completed', {
            templateName: input.templateName,
          });
        },

        // Run planning capability (Phase B)
        planningActor: async (input: PlanningInput): Promise<PlanningOutput> => {
          this.logger.info({ sessionId: input.sessionId }, 'Starting architectural planning');

          // Emit planning started
          this.emitPipelineStage(input.sessionId, 'planning', 'started');

          const capability = new PlanningCapability(this.modelName, this.io);
          const context: CapabilityContext = {
            sessionId: input.sessionId,
            prompt: input.prompt,
            sandboxPath: input.sandboxPath,
            tokens: { input: 0, output: 0, total: 0 },
            cost: 0,
            toolCalls: 0,
            startTime: Date.now(),
            abortSignal: this.abortController.signal,
          };

          const result = await capability.execute(context);

          if (!result.success) {
            this.logger.error(
              { sessionId: input.sessionId, error: result.error },
              'Planning failed',
            );
            // Emit planning failed
            this.emitPipelineStage(input.sessionId, 'planning', 'failed');
            throw new Error(result.error ?? 'Planning failed');
          }

          if (!result.contextUpdates?.plan) {
            // Emit planning failed
            this.emitPipelineStage(input.sessionId, 'planning', 'failed');
            throw new Error('Planning capability did not return a plan');
          }

          this.logger.info(
            {
              sessionId: input.sessionId,
              modelsCount: result.contextUpdates.plan.databaseModels?.length ?? 0,
              routesCount: result.contextUpdates.plan.apiRoutes?.length ?? 0,
              componentsCount: result.contextUpdates.plan.clientComponents?.length ?? 0,
            },
            'Planning completed',
          );

          // Emit planning completed with plan data
          this.emitPipelineStage(input.sessionId, 'planning', 'completed', {
            plan: result.contextUpdates.plan,
          });

          return {
            plan: result.contextUpdates.plan,
            tokensUsed: result.tokensUsed ?? { input: 0, output: 0 },
            cost: result.cost ?? 0,
            toolCalls: result.toolCalls ?? 0,
          };
        },

        // Run unified code generation capability
        codeGenerationActor: async (input: CodeGenerationInput): Promise<CodeGenerationOutput> => {
          this.logger.info({ sessionId: input.sessionId }, 'Starting code generation');

          const capability = new UnifiedCodeGenerationCapability(
            this.modelName,
            this.io,
            input.config,
          );
          const context: CapabilityContext = {
            sessionId: input.sessionId,
            prompt: input.prompt,
            sandboxPath: input.sandboxPath,
            plan: input.plan, // Pass plan from planning stage
            tokens: { input: 0, output: 0, total: 0 },
            cost: 0,
            toolCalls: 0,
            startTime: Date.now(),
            abortSignal: this.abortController.signal,
          };

          const result = await capability.execute(context);

          // IMPORTANT: Extract metrics even if generation failed
          // This ensures we track partial progress before the error
          const output: CodeGenerationOutput = {
            tokensUsed: result.tokensUsed ?? { input: 0, output: 0 },
            cost: result.cost ?? 0,
            toolCalls: result.toolCalls ?? 0,
          };

          if (!result.success) {
            this.logger.error(
              {
                sessionId: input.sessionId,
                error: result.error,
                partialMetrics: output,
              },
              'Code generation failed (captured partial metrics)',
            );
            // Throw error to transition to failed state, but metrics are preserved in output
            throw new Error(result.error ?? 'Code generation failed');
          }

          this.logger.info(
            {
              sessionId: input.sessionId,
              tokensUsed: result.tokensUsed,
              cost: result.cost,
              toolCalls: result.toolCalls,
            },
            'Code generation completed',
          );

          return output;
        },

        // Run validation capability (Phase B)
        validationActor: async (input: ValidationInput): Promise<ValidationOutput> => {
          this.logger.info({ sessionId: input.sessionId }, 'Starting validation');

          // Emit validation started
          this.emitPipelineStage(input.sessionId, 'validation', 'started');

          const capability = new ValidationCapability(this.modelName, this.io);
          const context: CapabilityContext = {
            sessionId: input.sessionId,
            prompt: '', // Not needed for validation
            sandboxPath: input.sandboxPath,
            tokens: { input: 0, output: 0, total: 0 },
            cost: 0,
            toolCalls: 0,
            startTime: Date.now(),
            abortSignal: this.abortController.signal,
          };

          const result = await capability.execute(context);

          if (!result.success) {
            this.logger.error(
              { sessionId: input.sessionId, error: result.error },
              'Validation failed',
            );
            // Emit validation failed
            this.emitPipelineStage(input.sessionId, 'validation', 'failed');
            throw new Error(result.error ?? 'Validation failed');
          }

          const validationErrors = result.contextUpdates?.validationErrors ?? [];

          this.logger.info(
            {
              sessionId: input.sessionId,
              errorCount: validationErrors.length,
            },
            'Validation completed',
          );

          // Emit validation completed with errors (if any)
          this.emitPipelineStage(input.sessionId, 'validation', 'completed', {
            validationErrors,
          });

          return { validationErrors };
        },

        // Run error fixing capability (Phase B)
        errorFixingActor: async (input: ErrorFixingInput): Promise<ErrorFixingOutput> => {
          this.logger.info(
            { sessionId: input.sessionId, iteration: input.errorFixAttempts + 1 },
            'Starting error fixing',
          );

          const capability = new ErrorFixingCapability(this.modelName, this.io);
          const context: CapabilityContext = {
            sessionId: input.sessionId,
            prompt: '', // Not needed - errors passed via context
            sandboxPath: input.sandboxPath,
            validationErrors: input.validationErrors,
            errorFixAttempts: input.errorFixAttempts,
            tokens: { input: 0, output: 0, total: 0 },
            cost: 0,
            toolCalls: 0,
            startTime: Date.now(),
            abortSignal: this.abortController.signal,
          };

          const result = await capability.execute(context);

          const output: ErrorFixingOutput = {
            tokensUsed: result.tokensUsed ?? { input: 0, output: 0 },
            cost: result.cost ?? 0,
            toolCalls: result.toolCalls ?? 0,
          };

          if (!result.success) {
            this.logger.error(
              {
                sessionId: input.sessionId,
                error: result.error,
                partialMetrics: output,
              },
              'Error fixing failed (captured partial metrics)',
            );
            throw new Error(result.error ?? 'Error fixing failed');
          }

          this.logger.info(
            {
              sessionId: input.sessionId,
              iteration: input.errorFixAttempts + 1,
              tokensUsed: result.tokensUsed,
              cost: result.cost,
              toolCalls: result.toolCalls,
            },
            'Error fixing completed',
          );

          return output;
        },

        // Persist metrics and emit completion event
        finishActor: async (input: FinishInput): Promise<void> => {
          this.logger.info({ sessionId: input.sessionId }, 'Finishing generation');

          // Emit completing stage
          this.emitPipelineStage(input.sessionId, 'completing', 'started');

          // Update database with final metrics
          try {
            await databaseService.updateSession(input.sessionId, {
              status: input.status,
              totalTokens: input.metrics.totalTokens,
              inputTokens: input.metrics.inputTokens,
              outputTokens: input.metrics.outputTokens,
              cost: input.metrics.cost.toString(),
              durationMs: input.metrics.duration,
              stepCount: input.metrics.steps,
              errorMessage: input.error,
            });
          } catch (error) {
            this.logger.error(
              { error, sessionId: input.sessionId, metrics: input.metrics },
              'Failed to update database with metrics',
            );
            this.io.to(input.sessionId).emit('warning', 'Metrics may not be persisted');
          }

          // Emit completion event
          this.io.to(input.sessionId).emit('generation_complete', {
            ...input.metrics,
            status: input.status,
          });

          // Cleanup message trackers
          cleanupSession(input.sessionId);

          // Emit completing stage completed
          const summary = `Generation ${input.status}. Tokens: ${input.metrics.totalTokens}, Cost: $${input.metrics.cost.toFixed(4)}, Duration: ${(input.metrics.duration / 1000).toFixed(1)}s`;
          this.emitPipelineStage(input.sessionId, 'completing', 'completed', { summary });

          this.logger.info({ sessionId: input.sessionId }, 'Generation finished');
        },
      },
      actions: {
        setupTimeout: () => {
          // Set up generation timeout (synchronous action)
          const env = getEnv();
          this.generationTimeout = setTimeout(() => {
            this.logger.warn(
              { sessionId, timeoutMs: env.GENERATION_TIMEOUT_MS },
              'Generation timeout reached, aborting',
            );
            this.abort();
          }, env.GENERATION_TIMEOUT_MS);
        },
        clearTimeout: () => {
          this.clearGenerationTimeout();
        },
      },
    });

    // Create actor and subscribe to state changes for logging
    const actor = createActor(machine, {
      input: { sessionId, prompt, config, modelName: this.modelName },
    });

    actor.subscribe((state) => {
      this.logger.info(
        {
          sessionId,
          state: state.value,
          context: {
            tokens: state.context.tokens,
            cost: state.context.cost,
            toolCalls: state.context.toolCalls,
            error: state.context.error,
          },
        },
        `[XState Machine] State changed: ${String(state.value)}`,
      );
    });

    actor.start();
    return actor;
  }

  /**
   * Generate an app using the unified capability system
   *
   * Event-driven orchestration via XState machine
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
      'Starting unified capability-based generation (XState-driven)',
    );

    // Create and start the state machine
    const actor = this.createMachine(sessionId, prompt, config);
    this.actor = actor;

    try {
      // Check if already aborted before starting
      if (this.abortController.signal.aborted) {
        actor.send({ type: 'ABORT' });
        throw new Error('Generation aborted');
      }

      // Send START event to begin generation
      actor.send({ type: 'START', sessionId, prompt, config, modelName: this.modelName });

      // Wait for machine to reach a final state
      const snapshot = await new Promise<ReturnType<typeof actor.getSnapshot>>(
        (resolve, reject) => {
          // Subscribe to state changes
          const subscription = actor.subscribe((state) => {
            // Check if we reached a final state
            if (state.status === 'done') {
              subscription.unsubscribe();
              resolve(state);
            }
          });

          // Set up abort handler with cleanup
          const abortHandler = () => {
            subscription.unsubscribe();
            this.abortController.signal.removeEventListener('abort', abortHandler);
            actor.send({ type: 'ABORT' });
            reject(new Error('Generation aborted'));
          };

          this.abortController.signal.addEventListener('abort', abortHandler, { once: true });
        },
      );

      // Extract final metrics from machine context
      const finalState = snapshot.value as string;
      const context = snapshot.context;
      const duration = Date.now() - context.startTime;

      // Build metrics from final machine context
      const metrics: GenerationMetrics = {
        sessionId,
        model: this.modelName,
        status:
          finalState === 'completed'
            ? 'completed'
            : finalState === 'cancelled'
              ? 'cancelled'
              : 'failed',
        totalTokens: context.tokens.total,
        inputTokens: context.tokens.input,
        outputTokens: context.tokens.output,
        cost: context.cost,
        duration,
        steps: context.toolCalls,
      };

      if (finalState === 'completed') {
        this.logger.info({ sessionId, metrics }, 'Generation completed successfully');
      } else if (finalState === 'cancelled') {
        this.logger.info({ sessionId, metrics }, 'Generation cancelled');
      } else {
        // failed
        this.logger.error({ sessionId, error: context.error, metrics }, 'Generation failed');
      }

      return metrics;
    } catch (error) {
      this.logger.error({ error, sessionId }, 'Generation error');

      // Extract partial metrics from machine context if available
      const partialMetrics = this.actor
        ? {
            totalTokens: this.actor.getSnapshot().context.tokens.total,
            inputTokens: this.actor.getSnapshot().context.tokens.input,
            outputTokens: this.actor.getSnapshot().context.tokens.output,
            cost: this.actor.getSnapshot().context.cost,
            toolCalls: this.actor.getSnapshot().context.toolCalls,
            duration: Date.now() - this.actor.getSnapshot().context.startTime,
          }
        : null;

      if (isAbortError(error)) {
        return this.handleAbort(sessionId, partialMetrics);
      }

      return this.handleGenerationError(sessionId, error, partialMetrics);
    } finally {
      // Always stop the actor
      this.actor?.stop();
    }
  }

  /**
   * Update database with final metrics
   */
  private async updateDatabase(
    sessionId: string,
    metrics: GenerationMetrics,
    status: 'completed' | 'cancelled' | 'failed',
    errorMessage?: string,
  ): Promise<boolean> {
    try {
      await databaseService.updateSession(sessionId, {
        status,
        totalTokens: metrics.totalTokens,
        inputTokens: metrics.inputTokens,
        outputTokens: metrics.outputTokens,
        cost: metrics.cost.toString(),
        durationMs: metrics.duration,
        stepCount: metrics.steps,
        errorMessage,
      });
      return true;
    } catch (error) {
      this.logger.error(
        {
          error,
          sessionId,
          metrics,
        },
        'Failed to update database with metrics',
      );
      return false;
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

  /**
   * Handle abort case
   */
  private async handleAbort(
    sessionId: string,
    partialMetrics: {
      totalTokens: number;
      inputTokens: number;
      outputTokens: number;
      cost: number;
      toolCalls: number;
      duration: number;
    } | null,
  ): Promise<GenerationMetrics> {
    const errorMsg = 'Generation aborted by user';

    this.logger.info({ sessionId, partialMetrics }, errorMsg);
    this.io.to(sessionId).emit('llm_message', {
      id: `${Date.now()}-system`,
      role: 'system',
      content: `⚠️ ${errorMsg}`,
      timestamp: Date.now(),
    });

    // Use partial metrics if available, otherwise create empty metrics
    const metrics: GenerationMetrics = partialMetrics
      ? {
          sessionId,
          model: this.modelName,
          status: 'cancelled',
          ...partialMetrics,
          steps: partialMetrics.toolCalls,
        }
      : this.createEmptyMetrics(sessionId, 0);

    const dbSuccess = await this.updateDatabase(sessionId, metrics, 'cancelled', errorMsg);

    if (!dbSuccess) {
      this.io.to(sessionId).emit('warning', 'Metrics may not be persisted');
    }

    this.emitComplete(sessionId, metrics, 'cancelled');
    cleanupSession(sessionId);
    return metrics;
  }

  /**
   * Handle generation error
   */
  private async handleGenerationError(
    sessionId: string,
    error: unknown,
    partialMetrics: {
      totalTokens: number;
      inputTokens: number;
      outputTokens: number;
      cost: number;
      toolCalls: number;
      duration: number;
    } | null,
  ): Promise<GenerationMetrics> {
    const errorMsg = getErrorMessage(error);
    this.logger.error({ error, sessionId, partialMetrics }, 'Generation failed with error');

    this.io.to(sessionId).emit('error', errorMsg);

    // Use partial metrics if available, otherwise create empty metrics
    const metrics: GenerationMetrics = partialMetrics
      ? {
          sessionId,
          model: this.modelName,
          status: 'failed',
          ...partialMetrics,
          steps: partialMetrics.toolCalls,
        }
      : this.createEmptyMetrics(sessionId, 0);

    const dbSuccess = await this.updateDatabase(sessionId, metrics, 'failed', errorMsg);

    if (!dbSuccess) {
      this.io.to(sessionId).emit('warning', 'Metrics may not be persisted');
    }

    this.emitComplete(sessionId, metrics, 'failed');
    cleanupSession(sessionId);
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
}
