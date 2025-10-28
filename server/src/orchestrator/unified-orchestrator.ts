import type { Server as SocketIOServer } from 'socket.io';
import { UnifiedCodeGenerationCapability } from '../capabilities/unified-code-generation.capability.js';
import { TemplateCapability } from '../capabilities/template.capability.js';
import type { BaseCapability } from '../capabilities/base.capability.js';
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
  GenerationStatus,
  ServerToClientEvents,
} from '../types/index.js';

/**
 * Unified Capability Orchestrator
 *
 * Simplified orchestrator that uses the new unified capability system.
 * All optional behaviors (planning, validation, building blocks) are handled
 * by tools within the UnifiedCodeGenerationCapability.
 *
 * This orchestrator only decides:
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
 * - Minimal orchestration logic
 * - LLM decides when to use optional features
 * - No mode explosion (no plan-based, template-plan-based, etc.)
 * - Single composable prompt system
 */
export class UnifiedOrchestrator {
  private static readonly DEFAULT_TEMPLATE_NAME = 'vite-fullstack-base';

  private modelName: ModelName;
  private io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>;
  private logger: ReturnType<typeof createLogger>;
  private abortController: AbortController;
  private generationTimeout?: NodeJS.Timeout;

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
   * Generate an app using the unified capability system
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
      'Starting unified capability-based generation',
    );

    // Set up generation timeout
    const { getEnv } = await import('../config/env.js');
    const env = getEnv();
    this.generationTimeout = setTimeout(() => {
      this.logger.warn(
        { sessionId, timeoutMs: env.GENERATION_TIMEOUT_MS },
        'Generation timeout reached, aborting',
      );
      this.abort();
    }, env.GENERATION_TIMEOUT_MS);

    try {
      // 1. Initialize sandbox on host filesystem
      const sandboxPath = await initializeSandbox(sessionId);

      // 2. Create Docker container immediately (execution sandbox)
      this.logger.info({ sessionId }, 'Creating Docker container');
      const { dockerService } = await import('../services/docker.service.js');
      await dockerService.createContainer(sessionId, sandboxPath);
      this.logger.info({ sessionId }, 'Docker container created with status: ready');

      // 3. Build simple pipeline (template copy + unified code generation)
      const capabilities = this.buildPipeline(config);

      this.logger.info(
        {
          sessionId,
          capabilityCount: capabilities.length,
          capabilityNames: capabilities.map((c) => c.getName()),
        },
        'Built unified capability pipeline',
      );

      // 4. Initialize context and execute pipeline
      const context = this.initializeContext(sessionId, prompt, sandboxPath);
      const executionResult = await this.executePipeline(capabilities, context);

      // 5. Clear timeout on success
      this.clearGenerationTimeout();

      // 6. Build and emit metrics
      const status = executionResult.success ? 'completed' : 'failed';
      const metrics = this.buildMetrics(context, status);

      this.logger.info(
        {
          sessionId,
          success: executionResult.success,
          metrics,
        },
        'Generation complete',
      );

      // 7. Update database with final metrics
      const dbSuccess = await this.updateDatabase(
        sessionId,
        metrics,
        status,
        executionResult.error,
      );

      if (!dbSuccess) {
        this.io.to(sessionId).emit('warning', 'Metrics may not be persisted');
      }

      // 8. Emit completion event
      this.emitComplete(sessionId, metrics, status);

      // 9. Cleanup message trackers to prevent memory leaks
      cleanupSession(sessionId);

      return metrics;
    } catch (error) {
      this.clearGenerationTimeout();

      // Cleanup message trackers on error/abort
      cleanupSession(sessionId);

      if (isAbortError(error)) {
        return this.handleAbort(sessionId);
      }

      return this.handleGenerationError(sessionId, error);
    }
  }

  /**
   * Build simple pipeline
   * Only decision: Template copy or not
   * All other behaviors handled via tools in UnifiedCodeGenerationCapability
   */
  private buildPipeline(config: CapabilityConfig): BaseCapability[] {
    const capabilities: BaseCapability[] = [];

    // Step 1: Template copy (if inputMode: 'template')
    if (config.inputMode === 'template') {
      capabilities.push(
        new TemplateCapability(
          this.modelName,
          this.io,
          config.templateOptions?.templateName ?? UnifiedOrchestrator.DEFAULT_TEMPLATE_NAME,
        ),
      );
    }

    // Step 2: Unified code generation with all tools
    // Tool call budget is derived from config.maxIterations
    capabilities.push(new UnifiedCodeGenerationCapability(this.modelName, this.io, config));

    return capabilities;
  }

  /**
   * Execute capability pipeline sequentially
   */
  private async executePipeline(
    capabilities: BaseCapability[],
    context: CapabilityContext,
  ): Promise<{ success: boolean; error?: string }> {
    for (const capability of capabilities) {
      const capabilityName = capability.getName();

      this.logger.info(
        {
          sessionId: context.sessionId,
          capability: capabilityName,
        },
        'Starting capability',
      );

      const result = await capability.execute(context);

      this.logger.info(
        {
          sessionId: context.sessionId,
          capability: capabilityName,
          success: result.success,
          tokensUsed: result.tokensUsed,
          cost: result.cost,
          toolCalls: result.toolCalls,
        },
        'Capability complete',
      );

      // Update context with metrics from this capability
      context.tokens.input += result.tokensUsed?.input ?? 0;
      context.tokens.output += result.tokensUsed?.output ?? 0;
      context.tokens.total = context.tokens.input + context.tokens.output;
      context.cost += result.cost ?? 0;
      context.toolCalls += result.toolCalls ?? 0;

      // If capability failed, stop pipeline
      if (!result.success) {
        return {
          success: false,
          error: result.error ?? 'Unknown error',
        };
      }

      // Check if aborted between capabilities
      if (this.isAborted()) {
        this.logger.info(
          { sessionId: context.sessionId },
          'Generation aborted between capabilities',
        );
        throw new Error('Generation aborted');
      }
    }

    return { success: true };
  }

  /**
   * Initialize execution context
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
   * Build final generation metrics from context
   */
  private buildMetrics(context: CapabilityContext, status: GenerationStatus): GenerationMetrics {
    const duration = Date.now() - context.startTime;

    return {
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
  }

  /**
   * Update database with final metrics
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
    status: GenerationStatus,
  ): void {
    this.io.to(sessionId).emit('generation_complete', {
      ...metrics,
      status,
    });
  }

  /**
   * Handle abort case
   */
  private async handleAbort(sessionId: string): Promise<GenerationMetrics> {
    const duration = 0;
    const errorMsg = 'Generation aborted by user';

    this.logger.info({ sessionId }, errorMsg);
    this.io.to(sessionId).emit('llm_message', {
      id: `${Date.now()}-system`,
      role: 'system',
      content: `⚠️ ${errorMsg}`,
      timestamp: Date.now(),
    });

    const metrics = this.createEmptyMetrics(sessionId, duration);
    const dbSuccess = await this.updateDatabase(sessionId, metrics, 'cancelled', errorMsg);

    if (!dbSuccess) {
      this.io.to(sessionId).emit('warning', 'Metrics may not be persisted');
    }

    this.emitComplete(sessionId, metrics, 'cancelled');
    return metrics;
  }

  /**
   * Handle generation error
   */
  private async handleGenerationError(
    sessionId: string,
    error: unknown,
  ): Promise<GenerationMetrics> {
    const duration = 0;
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
}
