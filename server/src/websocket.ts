import type { Server as HTTPServer } from 'node:http';
import type { AppInfo, AppLog, BuildEvent } from '@gen-fullstack/shared';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { Server as SocketIOServer } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { websocketLogger } from './lib/logger.js';
import { databaseService } from './services/database.service.js';
import { getSandboxPath, writeFile } from './services/filesystem.service.js';
import { processService } from './services/process.service.js';
import { NaiveStrategy } from './strategies/naive.strategy.js';
import { PlanFirstStrategy } from './strategies/plan-first.strategy.js';
import { TemplateStrategy } from './strategies/template.strategy.js';
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

  console.error('[Error Details]:', error);

  return 'An error occurred. Please try again.';
}

export function setupWebSocket(httpServer: HTTPServer) {
  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
    },
  });

  const rateLimiter = new RateLimiterMemory({
    points: RATE_LIMITS.BURST_SIZE, // Number of points
    duration: 1, // Per second
    blockDuration: 0, // Do not block, just reject
  });

  // Track active generations for cancellation support
  const activeGenerations = new Map<string, NaiveStrategy | PlanFirstStrategy | TemplateStrategy>();

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

  // Forward process service events to specific session rooms
  processService.on('app_status', (appInfo: AppInfo) => {
    if (appInfo.sessionId) {
      io.to(appInfo.sessionId).emit('app_status', appInfo);
    }
  });

  processService.on('app_log', (log: AppLog) => {
    if (log.sessionId) {
      io.to(log.sessionId).emit('app_log', log);
    }
  });

  processService.on('build_event', (event: BuildEvent) => {
    if (event.sessionId) {
      io.to(event.sessionId).emit('build_event', event);
    }
  });

  io.on('connection', (socket) => {
    websocketLogger.info({ socketId: socket.id }, 'Client connected');

    socket.on('subscribe_to_session', (payload) => {
      try {
        const { sessionId } = SubscribeSessionSchema.parse(payload);
        socket.join(sessionId);
        console.log(`Socket ${socket.id} subscribed to session: ${sessionId}`);
      } catch (error) {
        socket.emit('error', sanitizeError(error));
      }
    });

    socket.on('start_generation', async (payload) => {
      let sessionId: string | null = null;

      try {
        const validated = StartGenerationSchema.parse(payload);
        console.log('Starting generation with strategy:', validated.strategy);

        sessionId = uuidv4();

        socket.join(sessionId);
        console.log(`Socket ${socket.id} joined session room: ${sessionId}`);

        await databaseService.createSession({
          id: sessionId,
          prompt: validated.prompt,
          strategy: validated.strategy,
          status: 'generating',
        });

        socket.emit('session_started', { sessionId });

        let strategy: NaiveStrategy | PlanFirstStrategy | TemplateStrategy;
        switch (validated.strategy) {
          case 'naive':
            strategy = new NaiveStrategy();
            break;
          case 'plan-first':
            strategy = new PlanFirstStrategy();
            break;
          case 'template':
            strategy = new TemplateStrategy();
            break;
          default:
            // This should never happen due to Zod validation, but TypeScript requires exhaustive checking
            throw new Error(`Unknown strategy: ${validated.strategy}`);
        }

        // Track active generation for cancellation support
        activeGenerations.set(sessionId, strategy);

        try {
          await strategy.generateApp(validated.prompt, io, sessionId);
        } finally {
          // Always remove from active generations when done
          activeGenerations.delete(sessionId);
        }
      } catch (error) {
        console.error('Generation error:', error);

        // Update session status to failed if we created it
        if (sessionId) {
          try {
            await databaseService.updateSession(sessionId, {
              status: 'failed',
              errorMessage: error instanceof Error ? error.message : String(error),
            });
          } catch (dbError) {
            console.error('Failed to update session status:', dbError);
          }
        }

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
        console.log(`[WebSocket] Starting app for session: ${sessionId}`);

        const dockerAvailable = await processService.checkDockerAvailability();
        if (!dockerAvailable) {
          socket.emit('error', 'Docker is not available. Cannot start app.');
          socket.emit('app_status', {
            sessionId,
            status: 'failed',
            error: 'Docker not available',
          });
          return;
        }

        const workingDir = getSandboxPath(sessionId);

        await processService.startApp(sessionId, workingDir);
      } catch (error) {
        console.error('[WebSocket] Failed to start app:', error);
        socket.emit('error', sanitizeError(error));
      }
    });

    socket.on('stop_app', async (payload) => {
      try {
        const { sessionId } = AppActionSchema.parse(payload);
        console.log(`[WebSocket] Stopping app for session: ${sessionId}`);
        await processService.stopApp(sessionId);
      } catch (error) {
        console.error('[WebSocket] Failed to stop app:', error);
        socket.emit('error', sanitizeError(error));
      }
    });

    socket.on('restart_app', async (payload) => {
      try {
        const { sessionId } = AppActionSchema.parse(payload);
        console.log(`[WebSocket] Restarting app for session: ${sessionId}`);
        await processService.restartApp(sessionId);
      } catch (error) {
        console.error('[WebSocket] Failed to restart app:', error);
        socket.emit('error', sanitizeError(error));
      }
    });

    socket.on('get_app_status', (payload) => {
      try {
        const { sessionId } = AppActionSchema.parse(payload);
        const appStatus = processService.getAppStatus(sessionId);
        if (appStatus) {
          socket.emit('app_status', {
            sessionId: appStatus.sessionId,
            status: appStatus.status,
            clientPort: appStatus.clientPort,
            serverPort: appStatus.serverPort,
            clientUrl: appStatus.clientUrl,
            serverUrl: appStatus.serverUrl,
            error: appStatus.error,
            containerId: appStatus.containerId,
          });
        } else {
          // No app running for this session
          socket.emit('app_status', {
            sessionId,
            status: 'idle',
          });
        }
      } catch (error) {
        console.error('[WebSocket] Failed to get app status:', error);
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
        console.log(`[WebSocket] Saving file ${filePath} for session: ${sessionId}`);

        await writeFile(sessionId, filePath, content);

        await databaseService.saveFile({
          sessionId,
          path: filePath,
          content,
        });

        io.to(sessionId).emit('file_updated', { path: filePath, content });

        console.log(`[WebSocket] File ${filePath} saved successfully`);
      } catch (error) {
        console.error('[WebSocket] Failed to save file:', error);
        socket.emit('error', sanitizeError(error));
      }
    });

    socket.on('clear_workspace', () => {
      console.log('[WebSocket] Clearing workspace for client:', socket.id);

      // Clear workspace just resets client-side UI state
      // Files on disk remain intact for persistence
      socket.emit('workspace_cleared');
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  return io;
}
