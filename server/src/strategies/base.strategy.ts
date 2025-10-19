import type { LanguageModel } from 'ai';
import type { Server as SocketIOServer } from 'socket.io';
import { databaseService } from '../services/database.service.js';
import { initializeSandbox } from '../services/filesystem.service.js';
import { calculateCost, getModel, type ModelName } from '../services/llm.service.js';
import type {
  ClientToServerEvents,
  GenerationMetrics,
  ServerToClientEvents,
} from '../types/index.js';

export type { GenerationMetrics };

/**
 * Base abstract class for app generation strategies
 *
 * Provides common functionality for all strategies:
 * - Model management
 * - Sandbox initialization
 * - Metrics tracking
 * - WebSocket event emission
 * - Database persistence
 */
export abstract class BaseStrategy {
  protected model: LanguageModel;
  protected modelName: ModelName;
  private currentMessageId: string | null = null;
  private currentMessageRole: 'user' | 'assistant' | 'system' | null = null;
  private sessionId: string | null = null;

  constructor(modelName: ModelName = 'gpt-5-nano') {
    this.modelName = modelName;
    this.model = getModel(modelName);
  }

  /**
   * Get the strategy name for logging/identification
   */
  abstract getName(): string;

  /**
   * Get the system prompt for this strategy
   */
  abstract getSystemPrompt(): string;

  /**
   * Generate an app based on user prompt
   *
   * @param prompt - User's app description
   * @param io - Socket.io server instance for broadcasting to rooms
   * @param sessionId - Unique session identifier
   */
  abstract generateApp(
    prompt: string,
    io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
    sessionId: string,
  ): Promise<GenerationMetrics>;

  /**
   * Initialize sandbox for this generation
   *
   * @param sessionId - Session identifier
   * @returns Path to sandbox directory
   */
  protected async initializeSandbox(sessionId: string): Promise<string> {
    return await initializeSandbox(sessionId);
  }

  /**
   * Generate a unique message ID
   */
  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Set the session ID for database persistence
   */
  protected setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }

  /**
   * Emit a message to the client and persist to database
   *
   * @param io - Socket.io server instance
   * @param role - Message role (user, assistant, system)
   * @param content - Message content
   */
  protected emitMessage(
    io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
    role: 'user' | 'assistant' | 'system',
    content: string,
  ): void {
    const timestamp = Date.now();

    // If role changed, generate a new message ID
    if (this.currentMessageRole !== role) {
      this.currentMessageId = this.generateMessageId();
      this.currentMessageRole = role;
    }

    if (this.sessionId && this.currentMessageId) {
      io.to(this.sessionId).emit('llm_message', {
        id: this.currentMessageId,
        role,
        content,
        timestamp,
      });
    }

    if (this.sessionId && this.currentMessageId) {
      databaseService
        .upsertMessage(this.sessionId, this.currentMessageId, role, content, new Date(timestamp))
        .catch((err) => console.error('[BaseStrategy] Failed to upsert message:', err));
    }
  }

  /**
   * Emit a tool call event and persist to database
   *
   * @param io - Socket.io server instance
   * @param toolCallId - Unique tool call ID
   * @param toolName - Name of the tool being called
   * @param args - Tool arguments
   */
  protected emitToolCall(
    io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
    toolCallId: string,
    toolName: string,
    args: Record<string, unknown>,
  ): void {
    const timestamp = Date.now();

    this.currentMessageId = null;
    this.currentMessageRole = null;

    if (this.sessionId) {
      io.to(this.sessionId).emit('tool_call', {
        id: toolCallId,
        name: toolName,
        args,
        timestamp,
      });
    }

    // Persist to database (async, don't await to not block)
    if (this.sessionId) {
      databaseService
        .addTimelineItem({
          sessionId: this.sessionId,
          timestamp: new Date(timestamp),
          type: 'tool_call',
          toolCallId,
          toolName,
          toolArgs: JSON.stringify(args),
        })
        .catch((err) => console.error('[BaseStrategy] Failed to persist tool call:', err));
    }
  }

  /**
   * Emit a tool result event and persist to database
   *
   * @param io - Socket.io server instance
   * @param toolCallId - ID of the tool call this result is for
   * @param toolName - Name of the tool that was called
   * @param result - Result from tool execution
   */
  protected emitToolResult(
    io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
    toolCallId: string,
    toolName: string,
    result: string,
  ): void {
    const timestamp = Date.now();
    const resultId = `result-${toolCallId}`;

    if (this.sessionId) {
      io.to(this.sessionId).emit('tool_result', {
        id: resultId,
        toolName,
        result,
        timestamp,
      });
    }

    // Persist to database (async, don't await to not block)
    if (this.sessionId) {
      databaseService
        .addTimelineItem({
          sessionId: this.sessionId,
          timestamp: new Date(timestamp),
          type: 'tool_result',
          toolResultId: resultId,
          toolResultFor: toolCallId,
          toolName,
          result,
          isError: false,
        })
        .catch((err) => console.error('[BaseStrategy] Failed to persist tool result:', err));
    }
  }

  /**
   * Emit generation complete event with metrics and update database
   *
   * @param io - Socket.io server instance
   * @param metrics - Generation metrics
   */
  protected emitComplete(
    io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
    metrics: GenerationMetrics,
  ): void {
    if (this.sessionId) {
      io.to(this.sessionId).emit('generation_complete', {
        strategy: this.getName(),
        model: this.modelName,
        ...metrics,
      });
    }

    if (this.sessionId) {
      databaseService
        .updateSession(this.sessionId, {
          status: 'completed',
          completedAt: new Date(),
          inputTokens: metrics.inputTokens,
          outputTokens: metrics.outputTokens,
          totalTokens: metrics.totalTokens,
          cost: metrics.cost.toString(),
          durationMs: metrics.duration,
          stepCount: metrics.steps,
        })
        .catch((err) => console.error('[BaseStrategy] Failed to update session:', err));
    }
  }

  /**
   * Emit an error event and update database
   *
   * @param io - Socket.io server instance
   * @param error - Error message or Error object
   */
  protected emitError(
    io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
    error: string | Error,
  ): void {
    const message = error instanceof Error ? error.message : error;

    if (this.sessionId) {
      io.to(this.sessionId).emit('error', message);
    }

    console.error(`[${this.getName()}] Error:`, error);

    if (this.sessionId) {
      databaseService
        .updateSession(this.sessionId, {
          status: 'failed',
          errorMessage: message,
        })
        .catch((err) => console.error('[BaseStrategy] Failed to update session error:', err));
    }
  }

  /**
   * Calculate metrics from usage data
   *
   * @param inputTokens - Input tokens used
   * @param outputTokens - Output tokens generated
   * @param duration - Duration in milliseconds
   * @param steps - Number of steps taken
   * @returns Generation metrics
   */
  protected calculateMetrics(
    inputTokens: number,
    outputTokens: number,
    duration: number,
    steps: number,
  ): GenerationMetrics {
    if (!this.sessionId) {
      throw new Error('Session ID not set - calculateMetrics called before initialization');
    }

    const totalTokens = inputTokens + outputTokens;
    const cost = calculateCost(this.modelName, inputTokens, outputTokens);

    return {
      sessionId: this.sessionId,
      totalTokens,
      inputTokens,
      outputTokens,
      cost,
      duration,
      steps,
    };
  }

  protected logStart(_sessionId: string, _prompt: string): void {
    // Intentionally minimal - no logs
  }

  /**
   * Log strategy execution completion
   *
   * @param sessionId - Session identifier
   * @param metrics - Generation metrics
   */
  protected logComplete(sessionId: string, metrics: GenerationMetrics): void {
    console.log(
      `[${this.getName()}] Completed generation for session ${sessionId}`,
      `\nTokens: ${metrics.totalTokens} (in: ${metrics.inputTokens}, out: ${metrics.outputTokens})`,
      `\nCost: $${metrics.cost.toFixed(4)}`,
      `\nDuration: ${metrics.duration}ms`,
      `\nSteps: ${metrics.steps}`,
    );
  }

  /**
   * Create an onStepFinish handler for streamText calls
   *
   * This handler processes tool calls and results from the AI SDK,
   * emitting them via WebSocket and persisting to database.
   *
   * @param io - Socket.io server instance
   * @returns onStepFinish callback function
   */
  protected createOnStepFinishHandler(
    io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  ) {
    // biome-ignore lint/suspicious/noExplicitAny: AI SDK onStepFinish callback types are not strictly typed
    return ({ toolCalls, toolResults }: { toolCalls: any[]; toolResults: any[] }) => {
      // Emit tool calls with all data
      // AI SDK 5.0 changed property names: toolCall.args → toolCall.input, toolCall.id → toolCall.toolCallId
      for (const toolCall of toolCalls) {
        const toolInput =
          typeof toolCall.input === 'object' && toolCall.input !== null
            ? (toolCall.input as Record<string, unknown>)
            : {};

        this.emitToolCall(io, toolCall.toolCallId, toolCall.toolName, toolInput);
      }

      for (const toolResult of toolResults) {
        const result =
          typeof toolResult.output === 'string'
            ? toolResult.output
            : JSON.stringify(toolResult.output);

        this.emitToolResult(io, toolResult.toolCallId, toolResult.toolName, result);
      }
    };
  }

  /**
   * Process stream text generation results
   *
   * Handles the common pattern of:
   * 1. Processing fullStream for text deltas
   * 2. Waiting for usage stats and steps
   * 3. Calculating and returning metrics
   *
   * This eliminates 170+ lines of duplication across strategies.
   *
   * @param io - Socket.io server instance
   * @param result - StreamText result from AI SDK
   * @param startTime - Start timestamp for duration calculation
   * @returns Generation metrics
   */
  protected async processStreamResult(
    io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
    // biome-ignore lint/suspicious/noExplicitAny: AI SDK types are complex and vary
    result: any,
    startTime: number,
  ): Promise<GenerationMetrics> {
    // Process the full stream for text deltas
    for await (const part of result.fullStream) {
      switch (part.type) {
        case 'text-delta':
          // Stream text deltas to client
          if (part.text) {
            this.emitMessage(io, 'assistant', part.text);
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
    return this.calculateMetrics(
      usage.inputTokens || 0,
      usage.outputTokens || 0,
      duration,
      steps?.length || 0,
    );
  }

  /**
   * Handle generation errors consistently across all strategies
   *
   * Processes errors by:
   * 1. Calculating duration from start time
   * 2. Emitting error event to client
   * 3. Returning partial metrics with zero tokens
   *
   * This eliminates duplication across strategy error handlers.
   *
   * @param io - Socket.io server instance
   * @param startTime - Start timestamp for duration calculation
   * @param error - Error to handle
   * @returns Partial metrics with error information
   */
  protected handleGenerationError(
    io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
    startTime: number,
    error: unknown,
  ): GenerationMetrics {
    const duration = Date.now() - startTime;
    this.emitError(io, error as Error);
    return this.calculateMetrics(0, 0, duration, 0);
  }
}
