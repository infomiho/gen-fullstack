/**
 * oRPC Router for Sessions
 *
 * Type-safe RPC procedures for session management.
 * Replaces REST endpoints with auto-inferred types.
 */

import { os } from '@orpc/server';
import {
  DeleteSessionInputSchema,
  DeleteSessionOutputSchema,
  GetReplayDataInputSchema,
  GetReplayDataOutputSchema,
  GetSessionInputSchema,
  GetSessionOutputSchema,
  ListSessionsOutputSchema,
} from '@gen-fullstack/shared';
import { databaseService } from '../services/database.service.js';
import { routesLogger } from '../lib/logger.js';

/**
 * List all sessions (most recent first)
 */
const listSessions = os.output(ListSessionsOutputSchema).handler(async () => {
  try {
    const sessions = await databaseService.listSessions();
    return { sessions };
  } catch (error) {
    routesLogger.error({ error }, 'Failed to list sessions');
    const message = error instanceof Error ? error.message : 'Failed to list sessions';
    throw new Error(message);
  }
});

/**
 * Get a specific session with its full timeline and files
 */
const getSession = os
  .input(GetSessionInputSchema)
  .output(GetSessionOutputSchema)
  .handler(async ({ input }) => {
    try {
      const { sessionId } = input;

      // Fetch session, timeline, and files in parallel
      const [session, timeline, files] = await Promise.all([
        databaseService.getSession(sessionId),
        databaseService.getTimelineItems(sessionId),
        databaseService.getFiles(sessionId),
      ]);

      if (!session) {
        throw new Error('Session not found');
      }

      return {
        session,
        timeline,
        files,
      };
    } catch (error) {
      routesLogger.error({ error, sessionId: input.sessionId }, 'Failed to get session');
      const message = error instanceof Error ? error.message : 'Failed to get session';
      throw new Error(message);
    }
  });

/**
 * Get all data needed for replay mode
 * Returns session with pre-calculated duration and all timeline items/files
 */
const getReplayData = os
  .input(GetReplayDataInputSchema)
  .output(GetReplayDataOutputSchema)
  .handler(async ({ input }) => {
    try {
      const { sessionId } = input;

      // Fetch session, timeline, and files in parallel
      const [session, timeline, files] = await Promise.all([
        databaseService.getSession(sessionId),
        databaseService.getTimelineItems(sessionId),
        databaseService.getFiles(sessionId),
      ]);

      if (!session) {
        throw new Error('Session not found');
      }

      // Only allow replay for completed or failed sessions
      if (session.status === 'generating') {
        throw new Error('Cannot replay session that is still generating');
      }

      // Calculate duration
      const sessionStartTime = session.createdAt.getTime();
      const lastEventTime =
        timeline.length > 0
          ? Math.max(...timeline.map((item) => new Date(item.timestamp).getTime()))
          : sessionStartTime;
      const duration = lastEventTime - sessionStartTime;

      // Type-specific transformers for timeline items
      type TimelineItem = (typeof timeline)[0];
      type TransformedItem = { id: string; data: Record<string, unknown> };

      const timelineTransformers: Record<string, (item: TimelineItem) => TransformedItem> = {
        message: (item) => ({
          id: String(item.id),
          data: {
            role: item.role,
            content: item.content,
          },
        }),

        tool_call: (item) => ({
          id: item.toolCallId || String(item.id),
          data: {
            name: item.toolName,
            parameters: item.toolArgs ? JSON.parse(item.toolArgs) : {},
            reason: item.toolReason,
          },
        }),

        tool_result: (item) => ({
          id: String(item.id),
          data: {
            toolCallId: item.toolResultFor,
            toolName: item.toolName,
            result: item.result,
          },
        }),

        pipeline_stage: (item) => ({
          id: item.stageId || String(item.id),
          data: {
            type: item.stageType,
            status: item.stageStatus,
            data: item.stageData ? JSON.parse(item.stageData) : {},
          },
        }),
      };

      // Transform timeline items for replay
      const timelineItems = timeline.map((item) => {
        const transformer = timelineTransformers[item.type];
        const { id, data } = transformer(item);

        return {
          id,
          type: item.type,
          timestamp: new Date(item.timestamp).getTime(),
          data,
        };
      });

      // Transform files for replay
      const replayFiles = files.map((file) => ({
        path: file.path,
        timestamp: file.createdAt.getTime(),
        content: file.content,
      }));

      return {
        sessionStartTime,
        duration,
        timelineItems,
        files: replayFiles,
      };
    } catch (error) {
      routesLogger.error({ error, sessionId: input.sessionId }, 'Failed to get replay data');
      const message = error instanceof Error ? error.message : 'Failed to get replay data';
      throw new Error(message);
    }
  });

/**
 * Delete a session and all its associated data (timeline + files)
 */
const deleteSession = os
  .input(DeleteSessionInputSchema)
  .output(DeleteSessionOutputSchema)
  .handler(async ({ input }) => {
    try {
      const { sessionId } = input;

      // Check if session exists
      const session = await databaseService.getSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      // Delete session (cascade will delete timeline and files)
      await databaseService.deleteSession(sessionId);

      return { success: true, message: 'Session deleted' };
    } catch (error) {
      routesLogger.error({ error, sessionId: input.sessionId }, 'Failed to delete session');
      const message = error instanceof Error ? error.message : 'Failed to delete session';
      throw new Error(message);
    }
  });

/**
 * Sessions router
 * Exports procedures grouped under 'sessions' namespace
 */
export const sessionsRouter = {
  sessions: {
    list: listSessions,
    get: getSession,
    getReplayData: getReplayData,
    delete: deleteSession,
  },
};

/**
 * Export router type for client inference
 */
export type SessionsRouter = typeof sessionsRouter;
