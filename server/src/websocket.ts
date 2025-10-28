import type { Server as HTTPServer } from 'node:http';
import type { AppInfo, AppLog, BuildEvent } from '@gen-fullstack/shared';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { Server as SocketIOServer } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { getEnv } from './config/env.js';
import { websocketLogger } from './lib/logger.js';
import { UnifiedOrchestrator } from './orchestrator/unified-orchestrator.js';
import { databaseService } from './services/database.service.js';
import { dockerService } from './services/docker.service.js';
import { getSandboxPath, writeFile } from './services/filesystem.service.js';
import type { ClientToServerEvents, ServerToClientEvents } from './types/index.js';
import {
  AppActionSchema,
  RATE_LIMITS,
  SaveFileSchema,
  StartGenerationSchema,
  SubscribeSessionSchema,
} from './types/index.js';

/**
 * Sanitize error messages to prevent information leakage
 */
function sanitizeError(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'An unexpected error occurred';
  }

  // Map known error codes to user-friendly messages
  const errorMap: Record<string, string> = {
    ENOENT: 'File or directory not found',
    EACCES: 'Permission denied',
    EEXIST: 'File already exists',
    ENOTDIR: 'Not a directory',
    EISDIR: 'Path is a directory',
  };

  // Check for Node.js error code
  if ('code' in error && typeof error.code === 'string' && error.code in errorMap) {
    return errorMap[error.code];
  }

  // Check for validation errors (safe to expose)
  if (error instanceof z.ZodError) {
    return `Validation error: ${error.errors.map((e) => e.message).join(', ')}`;
  }

  // Safe error message patterns
  if (error.message.includes('Docker')) {
    return 'Docker operation failed';
  }
  if (error.message.includes('not available') || error.message.includes('not found')) {
    return 'Resource not available';
  }
  if (error.message.includes('Invalid') || error.message.includes('validation')) {
    return 'Invalid input provided';
  }

  websocketLogger.error({ error }, 'Unhandled error');

  return 'An error occurred. Please try again.';
}

/**
 * Handle session creation failure
 */
async function handleGenerationError(sessionId: string | null, error: unknown): Promise<void> {
  if (!sessionId) return;

  try {
    await databaseService.updateSession(sessionId, {
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  } catch (dbError) {
    websocketLogger.error({ error: dbError, sessionId }, 'Failed to update session status');
  }
}

// Track active generations for cancellation support (module-level for access by shutdown handler)
const activeGenerations = new Map<string, UnifiedOrchestrator>();

/**
 * Get all active generation orchestrators
 * Used by SIGTERM handler for graceful shutdown
 */
export function getActiveGenerations(): Map<string, UnifiedOrchestrator> {
  return activeGenerations;
}

export function setupWebSocket(httpServer: HTTPServer) {
  const env = getEnv();
  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: env.CLIENT_URL,
      methods: ['GET', 'POST'],
    },
  });

  const rateLimiter = new RateLimiterMemory({
    points: RATE_LIMITS.BURST_SIZE, // Number of points
    duration: 1, // Per second
    blockDuration: 0, // Do not block, just reject
  });

  /**
   * Apply rate limiting to a handler
   */
  async function checkRateLimit(socketId: string): Promise<boolean> {
    try {
      await rateLimiter.consume(socketId, 1);
      return true;
    } catch (_rejRes) {
      return false;
    }
  }

  // Forward Docker service events to specific session rooms
  dockerService.on('status_change', (data: Partial<AppInfo>) => {
    if (data.sessionId && data.status) {
      const status = dockerService.getStatus(data.sessionId);
      if (status) {
        io.to(data.sessionId).emit('app_status', status);
      }
    }
  });

  dockerService.on('log', (log: AppLog) => {
    if (log.sessionId) {
      io.to(log.sessionId).emit('app_log', log);
    }
  });

  dockerService.on('build_event', (event: BuildEvent) => {
    if (event.sessionId) {
      io.to(event.sessionId).emit('build_event', event);
    }
  });

  io.on('connection', (socket) => {
    websocketLogger.info({ socketId: socket.id }, 'Client connected');

    socket.on('subscribe_to_session', (payload) => {
      try {
        const { sessionId } = SubscribeSessionSchema.parse(payload);

        // If already in this room, no need to leave/rejoin (avoids race condition)
        if (socket.rooms.has(sessionId)) {
          websocketLogger.debug(
            { socketId: socket.id, sessionId },
            'Already subscribed to session',
          );
          return;
        }

        // Leave all previous session rooms before joining the new one
        // Note: socket.rooms is a Set<string> containing all rooms this socket is in
        // Every socket is automatically in a room matching its socket.id (never leave this!)
        socket.rooms.forEach((room) => {
          if (room !== socket.id) {
            socket.leave(room);
            websocketLogger.debug({ socketId: socket.id, leftRoom: room }, 'Left previous room');
          }
        });

        // Now join the new session room (client only in ONE session)
        socket.join(sessionId);
        websocketLogger.info({ socketId: socket.id, sessionId }, 'Socket subscribed to session');
      } catch (error) {
        socket.emit('error', sanitizeError(error));
      }
    });

    socket.on('start_generation', async (payload) => {
      let sessionId: string | null = null;

      try {
        const validated = StartGenerationSchema.parse(payload);
        websocketLogger.info({ config: validated.config }, 'Starting generation');

        sessionId = uuidv4();

        socket.join(sessionId);
        websocketLogger.info({ socketId: socket.id, sessionId }, 'Socket joined session room');

        // Create session in database before emitting session_started
        // This ensures the data is ready when clientLoader fetches it
        await databaseService.createSession({
          id: sessionId,
          prompt: validated.prompt,
          capabilityConfig: JSON.stringify(validated.config),
          status: 'generating',
        });

        socket.emit('session_started', { sessionId });

        const orchestrator = new UnifiedOrchestrator(validated.model, io);

        // Track active generation for cancellation support
        activeGenerations.set(sessionId, orchestrator);

        try {
          await orchestrator.generateApp(validated.prompt, validated.config, sessionId);
        } finally {
          // Always remove from active generations when done
          activeGenerations.delete(sessionId);
        }
      } catch (error) {
        websocketLogger.error({ error, sessionId }, 'Generation error');
        await handleGenerationError(sessionId, error);
        socket.emit('error', sanitizeError(error));
      }
    });

    socket.on('stop_generation', async () => {
      let sessionId: string | undefined;
      try {
        // Get sessionId from the socket's joined rooms
        // The socket should be in a room named after the sessionId
        const rooms = Array.from(socket.rooms);
        sessionId = rooms.find((room) => room !== socket.id);

        if (!sessionId) {
          socket.emit('error', 'No active session found');
          return;
        }

        websocketLogger.info({ sessionId }, 'Stop generation requested');

        // Get the active strategy and abort it
        const strategy = activeGenerations.get(sessionId);
        if (strategy) {
          // AbortController.abort() is idempotent - safe to call multiple times
          strategy.abort();
          websocketLogger.info({ sessionId }, 'Abort requested');
        } else {
          // Not necessarily an error - generation may have just completed naturally
          websocketLogger.info({ sessionId }, 'No active generation found (may have completed)');
        }
      } catch (error) {
        websocketLogger.error({ error, sessionId }, 'Error stopping generation');
        socket.emit('error', sanitizeError(error));
      }
    });

    socket.on('start_app', async (payload) => {
      try {
        const { sessionId } = AppActionSchema.parse(payload);
        websocketLogger.info({ sessionId }, 'Starting app');

        const status = dockerService.getStatus(sessionId);

        // If no container exists, create one
        if (!status) {
          websocketLogger.info({ sessionId }, 'No container found, creating new one');
          const workingDir = getSandboxPath(sessionId);
          await dockerService.createContainer(sessionId, workingDir);
        } else if (status.status !== 'ready') {
          // Container exists but is not in ready state
          socket.emit('error', `Cannot start app in state: ${status.status}`);
          return;
        }

        // Install dependencies (if not already installed) and start dev servers
        await dockerService.installDependencies(sessionId);
        await dockerService.startDevServer(sessionId);
      } catch (error) {
        websocketLogger.error({ error }, 'Failed to start app');
        socket.emit('error', sanitizeError(error));
      }
    });

    socket.on('stop_app', async (payload) => {
      try {
        const { sessionId } = AppActionSchema.parse(payload);
        websocketLogger.info({ sessionId }, 'Stopping app');

        const status = dockerService.getStatus(sessionId);
        if (!status) {
          socket.emit('error', 'No container found.');
          return;
        }

        // Stop dev servers but keep container in ready state
        await dockerService.stopDevServer(sessionId);
      } catch (error) {
        websocketLogger.error({ error }, 'Failed to stop app');
        socket.emit('error', sanitizeError(error));
      }
    });

    socket.on('restart_app', async (payload) => {
      try {
        const { sessionId } = AppActionSchema.parse(payload);
        websocketLogger.info({ sessionId }, 'Restarting app');

        const status = dockerService.getStatus(sessionId);
        if (!status) {
          socket.emit('error', 'No container found. Please generate an app first.');
          return;
        }

        // Stop dev server (if running) and restart it
        if (status.status === 'running') {
          await dockerService.stopDevServer(sessionId);
        }

        // Container should now be in 'ready' state with dependencies installed
        // Just start the dev servers again
        await dockerService.startDevServer(sessionId);
      } catch (error) {
        websocketLogger.error({ error }, 'Failed to restart app');
        socket.emit('error', sanitizeError(error));
      }
    });

    socket.on('get_app_status', (payload) => {
      try {
        const { sessionId } = AppActionSchema.parse(payload);
        const appStatus = dockerService.getStatus(sessionId);
        if (appStatus) {
          socket.emit('app_status', appStatus);
        } else {
          // No container for this session
          socket.emit('app_status', {
            sessionId,
            status: 'stopped',
          });
        }
      } catch (error) {
        websocketLogger.error({ error }, 'Failed to get app status');
        socket.emit('error', sanitizeError(error));
      }
    });

    socket.on('save_file', async (payload) => {
      if (!(await checkRateLimit(socket.id))) {
        socket.emit('error', 'Too many requests. Please slow down.');
        return;
      }

      try {
        const { sessionId, path: filePath, content } = SaveFileSchema.parse(payload);
        websocketLogger.info({ sessionId, filePath }, 'Saving file');

        // writeFile now handles both disk and database writes atomically
        await writeFile(sessionId, filePath, content);

        io.to(sessionId).emit('file_updated', { path: filePath, content });

        websocketLogger.info({ sessionId, filePath }, 'File saved successfully');
      } catch (error) {
        websocketLogger.error({ error }, 'Failed to save file');
        socket.emit('error', sanitizeError(error));
      }
    });

    socket.on('clear_workspace', () => {
      websocketLogger.info({ socketId: socket.id }, 'Clearing workspace for client');

      // Clear workspace just resets client-side UI state
      // Files on disk remain intact for persistence
      socket.emit('workspace_cleared');
    });

    socket.on('disconnect', () => {
      websocketLogger.info({ socketId: socket.id }, 'Client disconnected');
    });
  });

  return io;
}
