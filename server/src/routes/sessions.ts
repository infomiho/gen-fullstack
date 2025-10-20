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
