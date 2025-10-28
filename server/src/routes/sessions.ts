/**
 * Session Recovery API Routes
 *
 * Provides REST endpoints for retrieving persisted sessions, timelines, and files.
 */

import { Router } from 'express';
import { routesLogger } from '../lib/logger.js';
import { databaseService } from '../services/database.service.js';

const router: Router = Router();

/**
 * GET /api/sessions
 *
 * List all sessions (most recent first)
 */
router.get('/', async (_req, res) => {
  try {
    const sessions = await databaseService.listSessions();
    res.json({ sessions });
  } catch (error) {
    routesLogger.error({ error }, 'Failed to list sessions');
    const message = error instanceof Error ? error.message : 'Failed to list sessions';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/sessions/:sessionId
 *
 * Get a specific session with its full timeline and files
 */
router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Fetch session, timeline, and files in parallel
    const [session, timeline, files] = await Promise.all([
      databaseService.getSession(sessionId),
      databaseService.getTimelineItems(sessionId),
      databaseService.getFiles(sessionId),
    ]);

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    res.json({
      session,
      timeline,
      files,
    });
  } catch (error) {
    routesLogger.error({ error, sessionId: req.params.sessionId }, 'Failed to get session');
    const message = error instanceof Error ? error.message : 'Failed to get session';
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/sessions/:sessionId/replay-data
 *
 * Get all data needed for replay mode
 * Returns session with pre-calculated duration and all timeline items/files
 */
router.get('/:sessionId/replay-data', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Fetch session, timeline, and files in parallel
    const [session, timeline, files] = await Promise.all([
      databaseService.getSession(sessionId),
      databaseService.getTimelineItems(sessionId),
      databaseService.getFiles(sessionId),
    ]);

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Only allow replay for completed or failed sessions
    if (session.status === 'generating') {
      res.status(400).json({ error: 'Cannot replay session that is still generating' });
      return;
    }

    // Calculate duration
    const sessionStartTime = session.createdAt.getTime();
    const lastEventTime =
      timeline.length > 0
        ? Math.max(...timeline.map((item) => new Date(item.timestamp).getTime()))
        : sessionStartTime;
    const duration = lastEventTime - sessionStartTime;

    // Transform timeline items for replay
    const timelineItems = timeline.map((item) => {
      let data: Record<string, unknown> = {};
      let id = String(item.id);

      if (item.type === 'message') {
        data = {
          role: item.role,
          content: item.content,
        };
      } else if (item.type === 'tool_call') {
        // Use toolCallId as the ID for tool calls (e.g., "toolu_123")
        id = item.toolCallId || String(item.id);
        data = {
          name: item.toolName,
          parameters: item.toolArgs ? JSON.parse(item.toolArgs) : {},
          reason: item.toolReason,
        };
      } else if (item.type === 'tool_result') {
        data = {
          toolCallId: item.toolResultFor,
          toolName: item.toolName,
          result: item.result,
        };
      } else if (item.type === 'pipeline_stage') {
        // Use stageId as the ID for pipeline stages
        id = item.stageId || String(item.id);
        data = {
          type: item.stageType,
          status: item.stageStatus,
          data: item.stageData ? JSON.parse(item.stageData) : {},
        };
      }

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

    res.json({
      sessionStartTime,
      duration,
      timelineItems,
      files: replayFiles,
    });
  } catch (error) {
    routesLogger.error({ error, sessionId: req.params.sessionId }, 'Failed to get replay data');
    const message = error instanceof Error ? error.message : 'Failed to get replay data';
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/sessions/:sessionId
 *
 * Delete a session and all its associated data (timeline + files)
 */
router.delete('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Check if session exists
    const session = await databaseService.getSession(sessionId);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Delete session (cascade will delete timeline and files)
    await databaseService.deleteSession(sessionId);

    res.json({ success: true, message: 'Session deleted' });
  } catch (error) {
    routesLogger.error({ error, sessionId: req.params.sessionId }, 'Failed to delete session');
    const message = error instanceof Error ? error.message : 'Failed to delete session';
    res.status(500).json({ error: message });
  }
});

export default router;
