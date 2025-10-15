import type { LanguageModel } from 'ai';
import type { Socket } from 'socket.io';
import { initializeSandbox } from '../services/filesystem.service.js';
import { calculateCost, getModel, type ModelName } from '../services/llm.service.js';
import { databaseService } from '../services/database.service.js';
import type { GenerationMetrics } from '../types/index.js';

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

  constructor(modelName: ModelName = 'gpt-5-mini') {
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
   * @param socket - Socket.io connection for real-time updates
   * @param sessionId - Unique session identifier
   */
  abstract generateApp(
    prompt: string,
    socket: Socket,
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
   * @param socket - Socket.io connection
   * @param role - Message role (user, assistant, system)
   * @param content - Message content
   */
  protected emitMessage(
    socket: Socket,
    role: 'user' | 'assistant' | 'system',
    content: string,
  ): void {
    const timestamp = Date.now();

    // If role changed, generate a new message ID
    if (this.currentMessageRole !== role) {
      this.currentMessageId = this.generateMessageId();
      this.currentMessageRole = role;
    }

    socket.emit('llm_message', {
      id: this.currentMessageId,
      role,
      content,
      timestamp,
    });

    // Persist to database using upsert (async, don't await to not block)
    // This accumulates streaming chunks with the same messageId
    if (this.sessionId && this.currentMessageId) {
      databaseService
        .upsertMessage(this.sessionId, this.currentMessageId, role, content, new Date(timestamp))
        .catch((err) => console.error('[BaseStrategy] Failed to upsert message:', err));
    }
  }

  /**
   * Emit a tool call event and persist to database
   *
   * @param socket - Socket.io connection
   * @param toolCallId - Unique tool call ID
   * @param toolName - Name of the tool being called
   * @param args - Tool arguments
   */
  protected emitToolCall(
    socket: Socket,
    toolCallId: string,
    toolName: string,
    args: Record<string, unknown>,
  ): void {
    const timestamp = Date.now();

    socket.emit('tool_call', {
      id: toolCallId,
      name: toolName,
      args,
      timestamp,
    });

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
   * @param socket - Socket.io connection
   * @param toolCallId - ID of the tool call this result is for
   * @param toolName - Name of the tool that was called
   * @param result - Result from tool execution
   */
  protected emitToolResult(
    socket: Socket,
    toolCallId: string,
    toolName: string,
    result: string,
  ): void {
    const timestamp = Date.now();
    const resultId = `result-${toolCallId}`;

    socket.emit('tool_result', {
      id: resultId,
      toolName,
      result,
      timestamp,
    });

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
   * @param socket - Socket.io connection
   * @param metrics - Generation metrics
   */
  protected emitComplete(socket: Socket, metrics: GenerationMetrics): void {
    socket.emit('generation_complete', {
      strategy: this.getName(),
      model: this.modelName,
      ...metrics,
    });

    // Update session in database with final metrics
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
   * @param socket - Socket.io connection
   * @param error - Error message or Error object
   */
  protected emitError(socket: Socket, error: string | Error): void {
    const message = error instanceof Error ? error.message : error;
    socket.emit('error', message);
    console.error(`[${this.getName()}] Error:`, error);

    // Update session as failed in database
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
    const totalTokens = inputTokens + outputTokens;
    const cost = calculateCost(this.modelName, inputTokens, outputTokens);

    return {
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
}
