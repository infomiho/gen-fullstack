import type { LanguageModel } from 'ai';
import type { Server as SocketIOServer } from 'socket.io';
import type {
  CapabilityContext,
  CapabilityResult,
  ClientToServerEvents,
  ServerToClientEvents,
} from '../types/index.js';
import { createLogger } from '../lib/logger.js';
import { getModel, type ModelName } from '../services/llm.service.js';
import { databaseService } from '../services/database.service.js';

/**
 * Base class for all capabilities in the composable generation system
 *
 * Capabilities are self-contained units that perform specific tasks during
 * app generation (e.g., planning, template copying, code generation, validation).
 *
 * Each capability:
 * - Receives a context with current state
 * - Performs its specific task
 * - Returns a result with token/cost tracking
 * - Updates context for next capability
 */
export abstract class BaseCapability {
  protected model: LanguageModel;
  protected modelName: ModelName;
  protected io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>;
  protected logger: ReturnType<typeof createLogger>;

  constructor(
    modelName: ModelName,
    io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>,
  ) {
    this.modelName = modelName;
    this.model = getModel(modelName);
    this.io = io;
    this.logger = createLogger({ service: 'capability', name: this.getName() });
  }

  /**
   * Get the capability name for logging/identification
   */
  abstract getName(): string;

  /**
   * Execute this capability
   *
   * @param context - Current generation context
   * @returns Result with success status, token usage, and context updates
   */
  abstract execute(context: CapabilityContext): Promise<CapabilityResult>;

  /**
   * Check if this capability can be skipped based on context
   * (e.g., skip validation if no files were generated)
   *
   * @param _context - Current generation context
   * @returns true if capability should be skipped
   */
  canSkip(_context: CapabilityContext): boolean {
    // By default, capabilities are not skippable
    return false;
  }

  /**
   * Validate that the context has all required fields for this capability
   * Throws an error if validation fails
   *
   * @param _context - Current generation context
   * @throws Error if required context fields are missing
   */
  validateContext(_context: CapabilityContext): void {
    // By default, no validation is required
    // Override in subclasses that need specific context fields
  }

  // ============================================================================
  // Message Tracking (for database persistence)
  // ============================================================================

  private currentMessageId: string | null = null;
  private currentMessageRole: 'user' | 'assistant' | 'system' | null = null;

  /**
   * Generate a unique message ID
   */
  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  // ============================================================================
  // Shared Helper Methods
  // ============================================================================

  /**
   * Emit a message to the client and persist to database
   *
   * @param role - Message role (user, assistant, system)
   * @param content - Message content
   * @param sessionId - Session identifier
   */
  protected emitMessage(
    role: 'user' | 'assistant' | 'system',
    content: string,
    sessionId: string,
  ): void {
    const timestamp = Date.now();

    // System messages are discrete events (each should be a separate Timeline card)
    // Assistant/user messages are grouped by role (for streaming and deduplication)
    if (role === 'system' || this.currentMessageRole !== role) {
      this.currentMessageId = this.generateMessageId();
      this.currentMessageRole = role;
    }

    if (this.currentMessageId) {
      this.io.to(sessionId).emit('llm_message', {
        id: this.currentMessageId,
        role,
        content,
        timestamp,
      });
    }

    if (this.currentMessageId) {
      databaseService
        .upsertMessage(sessionId, this.currentMessageId, role, content, new Date(timestamp))
        .catch((err) => this.logger.error({ err, sessionId }, 'Failed to upsert message'));
    }
  }

  /**
   * Emit a tool call event and persist to database
   *
   * @param toolCallId - Unique tool call ID
   * @param toolName - Name of the tool being called
   * @param args - Tool arguments
   * @param sessionId - Session identifier
   */
  protected emitToolCall(
    toolCallId: string,
    toolName: string,
    args: Record<string, unknown>,
    sessionId: string,
  ): void {
    const timestamp = Date.now();

    this.currentMessageId = null;
    this.currentMessageRole = null;

    this.io.to(sessionId).emit('tool_call', {
      id: toolCallId,
      name: toolName,
      args,
      timestamp,
    });

    // Persist to database (async, don't await to not block)
    databaseService
      .addTimelineItem({
        sessionId,
        timestamp: new Date(timestamp),
        type: 'tool_call',
        toolCallId,
        toolName,
        toolArgs: JSON.stringify(args),
      })
      .catch((err) => this.logger.error({ err, sessionId }, 'Failed to persist tool call'));
  }

  /**
   * Emit a tool result event and persist to database
   *
   * @param toolCallId - ID of the tool call this result is for
   * @param toolName - Name of the tool that was called
   * @param result - Result from tool execution
   * @param sessionId - Session identifier
   */
  protected emitToolResult(
    toolCallId: string,
    toolName: string,
    result: string,
    sessionId: string,
  ): void {
    const timestamp = Date.now();
    const resultId = `result-${toolCallId}`;

    this.io.to(sessionId).emit('tool_result', {
      id: resultId,
      toolName,
      result,
      timestamp,
    });

    // Persist to database (async, don't await to not block)
    databaseService
      .addTimelineItem({
        sessionId,
        timestamp: new Date(timestamp),
        type: 'tool_result',
        toolResultId: resultId,
        toolResultFor: toolCallId,
        toolName,
        result,
        isError: false,
      })
      .catch((err) => this.logger.error({ err, sessionId }, 'Failed to persist tool result'));
  }

  /**
   * Check if generation was aborted
   *
   * @param context - Current generation context
   * @returns true if aborted
   */
  protected isAborted(context: CapabilityContext): boolean {
    return context.abortSignal.aborted;
  }

  /**
   * Emit a system status message
   *
   * @param message - Status message to display
   * @param context - Current generation context
   */
  protected emitStatus(message: string, context: CapabilityContext): void {
    this.emitMessage('system', message, context.sessionId);
  }
}
