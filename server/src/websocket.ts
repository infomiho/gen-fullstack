import type { Server as HTTPServer } from 'node:http';
import path from 'node:path';
import { Server as SocketIOServer } from 'socket.io';
import { z } from 'zod';
import { NaiveStrategy } from './strategies/naive.strategy.js';
import type { ClientToServerEvents, ServerToClientEvents } from './types/index.js';
import { StartGenerationSchema } from './types/index.js';
import { processService } from './services/process.service.js';
import type { AppInfo, AppLog, BuildEvent } from '@gen-fullstack/shared';

export function setupWebSocket(httpServer: HTTPServer) {
  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
    },
  });

  // Forward process service events to all connected clients
  processService.on('app_status', (appInfo: AppInfo) => {
    io.emit('app_status', appInfo);
  });

  processService.on('app_log', (log: AppLog) => {
    io.emit('app_log', log);
  });

  processService.on('build_event', (event: BuildEvent) => {
    io.emit('build_event', event);
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('start_generation', async (payload) => {
      try {
        // Validate payload with Zod
        const validated = StartGenerationSchema.parse(payload);
        console.log('Starting generation with strategy:', validated.strategy);

        // Emit session started event so client can track the session ID
        socket.emit('session_started', { sessionId: socket.id });

        // Instantiate strategy based on user selection
        // For now, we only have NaiveStrategy implemented
        let strategy: NaiveStrategy;
        switch (validated.strategy) {
          case 'naive':
          case 'plan-first':
          case 'template':
          case 'compiler-check':
          case 'building-blocks':
            // All strategies use NaiveStrategy for now
            // TODO: Implement other strategies in Phase 5
            strategy = new NaiveStrategy();
            break;
          default:
            throw new Error(`Unknown strategy: ${validated.strategy}`);
        }

        // Generate app using the selected strategy
        await strategy.generateApp(validated.prompt, socket, socket.id);
      } catch (error) {
        console.error('Generation error:', error);
        if (error instanceof z.ZodError) {
          socket.emit('error', `Invalid payload: ${error.errors.map((e) => e.message).join(', ')}`);
          return;
        }
        const message = error instanceof Error ? error.message : 'Unknown error occurred';
        socket.emit('error', message);
      }
    });

    socket.on('stop_generation', () => {
      console.log('Stopping generation');
      // TODO: Implement stop logic
    });

    // App execution handlers
    socket.on('start_app', async ({ sessionId }) => {
      try {
        console.log(`[WebSocket] Starting app for session: ${sessionId}`);

        // Check Docker availability first
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

        // Determine working directory for generated files
        // Files are in project root /generated/, not /server/generated/
        const workingDir = path.join(process.cwd(), '..', 'generated', sessionId);

        await processService.startApp(sessionId, workingDir);
      } catch (error) {
        console.error(`[WebSocket] Failed to start app ${sessionId}:`, error);
        const message = error instanceof Error ? error.message : 'Failed to start app';
        socket.emit('error', message);
      }
    });

    socket.on('stop_app', async ({ sessionId }) => {
      try {
        console.log(`Stopping app for session: ${sessionId}`);
        await processService.stopApp(sessionId);
      } catch (error) {
        console.error(`Failed to stop app ${sessionId}:`, error);
        const message = error instanceof Error ? error.message : 'Failed to stop app';
        socket.emit('error', message);
      }
    });

    socket.on('restart_app', async ({ sessionId }) => {
      try {
        console.log(`Restarting app for session: ${sessionId}`);
        await processService.restartApp(sessionId);
      } catch (error) {
        console.error(`Failed to restart app ${sessionId}:`, error);
        const message = error instanceof Error ? error.message : 'Failed to restart app';
        socket.emit('error', message);
      }
    });

    socket.on('clear_workspace', () => {
      console.log('Clearing workspace');
      // TODO: Implement clear logic
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  return io;
}
