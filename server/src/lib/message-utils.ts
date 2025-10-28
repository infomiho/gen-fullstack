/**
 * Message Emission Utilities
 *
 * Shared utilities for emitting messages with automatic database persistence.
 * Used by both capabilities and tools to ensure all messages are persisted.
 */

import { randomUUID } from 'node:crypto';
import type { Server as SocketIOServer } from 'socket.io';
import { retryOperation } from './retry-utils.js';
import { databaseService } from '../services/database.service.js';
import { createLogger } from './logger.js';
import type { ClientToServerEvents, ServerToClientEvents } from '../types/index.js';

const messageLogger = createLogger({ service: 'message-utils' });

/**
 * Message ID tracker for grouping consecutive messages of the same role
 *
 * Used to prevent creating separate timeline cards for streaming message chunks.
 * Each session gets its own tracker instance to maintain isolation.
 *
 * **Thread Safety**: NOT thread-safe. However, each session has its own tracker
 * instance, so concurrent sessions are safe. Rapid messages within one session
 * are processed sequentially by the event loop.
 *
 * **Lifecycle**: Trackers persist for the session lifetime and MUST be cleaned up
 * by calling `cleanupSession(sessionId)` when the session ends. The orchestrator
 * handles this automatically in `unified-orchestrator.ts`.
 *
 * **Memory Impact**: ~100 bytes per session (UUID string + role enum).
 * With 10,000 sessions, memory usage is ~1MB. Cleanup is essential for long-running
 * production servers to prevent unbounded growth.
 */
class MessageTracker {
  private currentMessageId: string | null = null;
  private currentMessageRole: 'user' | 'assistant' | 'system' | null = null;

  /**
   * Get or create a message ID for the given role
   * System messages always get new IDs (discrete events)
   * User/assistant messages are grouped by consecutive role
   */
  getMessageId(role: 'user' | 'assistant' | 'system'): string {
    // System messages are discrete events (each should be a separate Timeline card)
    // Assistant/user messages are grouped by role (for streaming and deduplication)
    if (role === 'system' || this.currentMessageRole !== role) {
      this.currentMessageId = `msg-${randomUUID()}`;
      this.currentMessageRole = role;
    }

    // Defensive check: should never happen due to logic above, but prevents silent bugs
    if (!this.currentMessageId) {
      messageLogger.error(
        { role, currentRole: this.currentMessageRole },
        'Unexpected state: messageId is null',
      );
      // Recover by generating new ID
      this.currentMessageId = `msg-${randomUUID()}`;
      this.currentMessageRole = role;
    }

    return this.currentMessageId;
  }

  /**
   * Reset tracking (e.g., when a tool call happens)
   */
  reset(): void {
    this.currentMessageId = null;
    this.currentMessageRole = null;
  }
}

// Track messages per session
const sessionTrackers = new Map<string, MessageTracker>();

function getTracker(sessionId: string): MessageTracker {
  if (!sessionTrackers.has(sessionId)) {
    sessionTrackers.set(sessionId, new MessageTracker());
  }
  return sessionTrackers.get(sessionId)!;
}

/**
 * IO type that accepts both full SocketIOServer and the simplified tool context IO
 */
type AcceptedIO =
  | SocketIOServer<ClientToServerEvents, ServerToClientEvents>
  | { to: (room: string) => { emit: (event: string, data: unknown) => void } }
  | undefined;

/**
 * Emit a message to the client and persist to database
 *
 * This is the single source of truth for message emission.
 * Used by both capabilities and tools.
 *
 * @param sessionId - Session identifier
 * @param io - Socket.IO server instance (optional for tools)
 * @param role - Message role (user, assistant, system)
 * @param content - Message content
 */
export function emitPersistedMessage(
  sessionId: string,
  io: AcceptedIO,
  role: 'user' | 'assistant' | 'system',
  content: string,
): void {
  const timestamp = Date.now();
  const tracker = getTracker(sessionId);
  const messageId = tracker.getMessageId(role);

  // Emit to WebSocket
  if (io) {
    io.to(sessionId).emit('llm_message', {
      id: messageId,
      role,
      content,
      timestamp,
    });
  }

  // Persist to database with retry logic for transient failures (e.g., SQLITE_BUSY)
  // Note: Fire-and-forget pattern is acceptable for messages (non-critical for generation)
  // but we add retries to reduce data loss from transient database contention
  retryOperation(
    () => databaseService.upsertMessage(sessionId, messageId, role, content, new Date(timestamp)),
    {
      maxRetries: 3,
      delayMs: 50,
      shouldRetry: (error: Error | unknown) => {
        // Retry on SQLite busy errors and other transient failures
        const errorMsg = error instanceof Error ? error.message : String(error);
        return errorMsg.includes('SQLITE_BUSY') || errorMsg.includes('database is locked');
      },
    },
  ).catch((err: Error | unknown) => {
    messageLogger.error(
      { err, sessionId, messageId, role },
      'Failed to persist message after retries',
    );
  });
}

/**
 * Reset message tracking after a generation step completes
 *
 * This is called automatically after each AI SDK step finishes (in `onStepFinish`).
 * A step includes text generation + tool calls + tool results. Resetting after the
 * step ensures text generated in the next step gets a new message ID.
 *
 * **When to call**:
 * - Automatically called in `BaseCapability.createOnStepFinishHandler()`
 * - Do NOT call manually unless you're implementing custom step handling
 *
 * **Example flow**:
 * - Step 1: "I'll check the weather" → [tool calls] → onStepFinish → reset
 * - Step 2: "The weather is sunny" ← gets new message ID
 *
 * @param sessionId - Session identifier
 */
export function resetMessageTracking(sessionId: string): void {
  const tracker = getTracker(sessionId);
  tracker.reset();
}

/**
 * Clean up message tracker when session ends
 *
 * **CRITICAL**: Must be called when a generation session completes, fails, or is aborted
 * to prevent memory leaks. The `UnifiedOrchestrator` handles this automatically.
 *
 * **When to Call**:
 * - On generation completion (success)
 * - On generation error/failure
 * - On user abort/cancellation
 * - On WebSocket disconnect (if session won't resume)
 *
 * **Safe to Call Multiple Times**: Idempotent - safe to call even if session doesn't exist.
 *
 * @param sessionId - Session identifier to clean up
 */
export function cleanupSession(sessionId: string): void {
  sessionTrackers.delete(sessionId);
}
