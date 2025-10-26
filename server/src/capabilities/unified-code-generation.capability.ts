import type { CapabilityConfig } from '@gen-fullstack/shared';
import { stepCountIs, streamText } from 'ai';
import type { Server as SocketIOServer } from 'socket.io';
import { buildSystemPrompt, buildUserPrompt } from '../config/prompt-builder.js';
import { getErrorMessage } from '../lib/error-utils.js';
import type { ModelName } from '../services/llm.service.js';
import { calculateCost } from '../services/llm.service.js';
import { getToolsForMode } from '../tools/index.js';
import type {
  CapabilityContext,
  CapabilityResult,
  ClientToServerEvents,
  ServerToClientEvents,
} from '../types/index.js';
import { BaseCapability } from './base.capability.js';

/**
 * Unified Code Generation Capability
 *
 * This is a simplified, unified capability that generates application code using LLM with tool calling.
 * All optional behaviors (planning, validation, building blocks) are handled via tools rather than
 * separate capabilities or modes.
 *
 * Features:
 * - Single composable prompt system (base + addons)
 * - Tool-based planning (planArchitecture tool)
 * - Tool-based validation (validatePrismaSchema, validateTypeScript tools)
 * - Tool-based building blocks (requestBlock tool)
 * - Generous tool call budget (LLM self-regulates)
 * - Token usage and cost tracking
 * - Real-time progress updates via WebSocket
 *
 * Design Philosophy:
 * - Move control from hardcoded orchestration to LLM self-orchestration
 * - Non-conflicting addons (no contradictory instructions)
 * - Minimal prompt size (~150 lines vs 328 lines in old system)
 * - LLM decides when to plan, validate, and use blocks
 */
export class UnifiedCodeGenerationCapability extends BaseCapability {
  private config: CapabilityConfig;
  private maxToolCalls: number;

  constructor(
    modelName: ModelName,
    io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
    config: CapabilityConfig,
  ) {
    super(modelName, io);
    this.config = config;
    // Derive tool call budget from maxIterations config
    // Base budget of 20 calls + (maxIterations * 5) for error fixing
    // iterations=1 → 25 calls, iterations=3 → 35 calls, iterations=5 → 45 calls
    this.maxToolCalls = 20 + config.maxIterations * 5;
  }

  getName(): string {
    return 'UnifiedCodeGeneration';
  }

  validateContext(context: CapabilityContext): void {
    if (!context.sessionId) {
      throw new Error('UnifiedCodeGenerationCapability requires context.sessionId');
    }
    if (!context.prompt) {
      throw new Error(
        'UnifiedCodeGenerationCapability requires context.prompt (user requirements)',
      );
    }
    if (!context.sandboxPath) {
      throw new Error('UnifiedCodeGenerationCapability requires context.sandboxPath');
    }
  }

  async execute(context: CapabilityContext): Promise<CapabilityResult> {
    this.validateContext(context);

    const { sessionId, abortSignal } = context;
    const startTime = Date.now();

    try {
      // Build prompts using composable system
      const systemPrompt = buildSystemPrompt(this.config);
      const userPrompt = buildUserPrompt(context.prompt, context.plan);

      // Store both prompts for debugging (don't fail generation if this fails)
      await this.storePromptsForDebugging(sessionId, systemPrompt, userPrompt);

      // Emit initial message based on configuration
      const enabledFeatures: string[] = [];
      if (this.config.inputMode === 'template') enabledFeatures.push('template');
      if (this.config.planning) enabledFeatures.push('planning');
      if (this.config.buildingBlocks) enabledFeatures.push('building blocks');
      if (this.config.compilerChecks) enabledFeatures.push('compiler checks');

      const featuresText = enabledFeatures.length > 0 ? ` (${enabledFeatures.join(', ')})` : '';

      this.emitMessage('assistant', `Starting code generation${featuresText}...`, sessionId);

      // Get tools filtered by input mode (installNpmDep only available in template mode)
      const availableTools = getToolsForMode(this.config.inputMode);

      // Stream text generation with tools
      const result = streamText({
        model: this.model,
        system: systemPrompt,
        prompt: userPrompt,
        tools: availableTools,
        experimental_context: { sessionId, io: this.io },
        stopWhen: stepCountIs(this.maxToolCalls),
        onStepFinish: this.createOnStepFinishHandler(sessionId),
        abortSignal,
      });

      // Process the full stream for text deltas
      for await (const part of result.fullStream) {
        switch (part.type) {
          case 'text-delta':
            // Stream text deltas to client
            if (part.text) {
              this.emitMessage('assistant', part.text, sessionId);
            }
            break;

          case 'finish':
            break;
        }
      }

      // Wait for usage stats (must await after stream is consumed)
      const [usage, steps] = await Promise.all([result.usage, result.steps]);

      // Calculate metrics
      const duration = Date.now() - startTime;
      const inputTokens = usage.inputTokens || 0;
      const outputTokens = usage.outputTokens || 0;
      const totalTokens = inputTokens + outputTokens;
      const cost = calculateCost(this.modelName, inputTokens, outputTokens);
      const toolCallCount = steps?.length || 0;

      this.logger.info(
        {
          sessionId,
          inputTokens,
          outputTokens,
          totalTokens,
          cost,
          toolCallCount,
          duration,
        },
        'Unified code generation completed',
      );

      return {
        success: true,
        tokensUsed: {
          input: inputTokens,
          output: outputTokens,
        },
        cost,
        toolCalls: toolCallCount,
      };
    } catch (error) {
      const errorMessage = getErrorMessage(error);

      this.logger.error(
        {
          error,
          sessionId,
        },
        'Unified code generation failed',
      );

      this.emitMessage('system', `✗ Code generation failed: ${errorMessage}`, sessionId);

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Store assembled prompts in database for debugging
   * Failures are logged but don't interrupt generation
   */
  private async storePromptsForDebugging(
    sessionId: string,
    systemPrompt: string,
    userPrompt: string,
  ): Promise<void> {
    try {
      const { databaseService } = await import('../services/database.service.js');
      await databaseService.updateSession(sessionId, {
        systemPrompt,
        fullUserPrompt: userPrompt,
      });
      this.logger.debug({ sessionId }, 'Stored prompts for debugging');
    } catch (error) {
      // Log but don't fail generation if prompt storage fails
      this.logger.warn(
        { error, sessionId },
        'Failed to store prompts for debugging (non-critical)',
      );
    }
  }
}
