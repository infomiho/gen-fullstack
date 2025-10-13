import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { z } from 'zod';
import type { ClientToServerEvents, ServerToClientEvents } from './types/index.js';
import { StartGenerationSchema } from './types/index.js';
import { NaiveStrategy } from './strategies/naive.strategy.js';

export function setupWebSocket(httpServer: HTTPServer) {
  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('start_generation', async (payload) => {
      try {
        // Validate payload with Zod
        const validated = StartGenerationSchema.parse(payload);
        console.log('Starting generation with strategy:', validated.strategy);

        // Instantiate strategy based on user selection
        // For now, we only have NaiveStrategy implemented
        let strategy;
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

    socket.on('restart_app', () => {
      console.log('Restarting app');
      // TODO: Implement restart logic
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
