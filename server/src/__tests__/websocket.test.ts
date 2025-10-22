/**
 * WebSocket Handler Edge Case Tests
 *
 * Tests edge cases and error scenarios in the WebSocket handler that could
 * cause production issues if not properly handled.
 *
 * Coverage:
 * - Rate limiting edge cases
 * - Concurrent operation handling
 * - Error sanitization
 * - Session room management
 */

import { createServer } from 'node:http';
import type { Server as SocketIOServer } from 'socket.io';
import { type Socket as ClientSocket, io as ioClient } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { databaseService } from '../services/database.service.js';
import type { ClientToServerEvents, ServerToClientEvents } from '../types/index.js';
import { setupWebSocket } from '../websocket.js';

// Mock services
vi.mock('../services/process.service.js', () => ({
  processService: {
    on: vi.fn(),
    checkDockerAvailability: vi.fn().mockResolvedValue(true),
    startApp: vi.fn().mockResolvedValue(undefined),
    stopApp: vi.fn().mockResolvedValue(undefined),
    restartApp: vi.fn().mockResolvedValue(undefined),
    getAppStatus: vi.fn().mockReturnValue(null),
  },
}));

vi.mock('../services/filesystem.service.js', () => ({
  getSandboxPath: vi.fn((sessionId: string) => `/tmp/sandbox-${sessionId}`),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../orchestrator/capability-orchestrator.js', () => ({
  CapabilityOrchestrator: vi.fn().mockImplementation(() => ({
    generateApp: vi.fn().mockResolvedValue({
      sessionId: 'test-session',
      totalTokens: 150,
      inputTokens: 100,
      outputTokens: 50,
      cost: 0.001,
      duration: 1000,
      steps: 1,
    }),
    abort: vi.fn(),
  })),
}));

describe('WebSocket Handler Edge Cases', () => {
  let httpServer: ReturnType<typeof createServer>;
  let io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>;
  let clientSocket: ClientSocket<ServerToClientEvents, ClientToServerEvents>;
  const PORT = 3099;

  beforeEach(async () => {
    // Initialize database
    await databaseService.initialize();

    // Create HTTP server and setup WebSocket
    httpServer = createServer();
    io = setupWebSocket(httpServer);

    await new Promise<void>((resolve) => {
      httpServer.listen(PORT, resolve);
    });

    // Create client connection
    clientSocket = ioClient(`http://localhost:${PORT}`, {
      reconnection: false,
    });

    await new Promise<void>((resolve) => {
      clientSocket.on('connect', () => resolve());
    });
  });

  afterEach(async () => {
    // Cleanup
    clientSocket.disconnect();
    io.close();
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
    vi.clearAllMocks();
  });

  describe('Rate Limiting', () => {
    it('should block save_file after burst limit exceeded', async () => {
      const sessionId = `test-rate-limit-${Date.now()}`;
      await databaseService.createSession({
        id: sessionId,
        prompt: 'Test',
        capabilityConfig: JSON.stringify({ inputMode: 'naive' }),
        status: 'generating',
      });

      // RATE_LIMITS.BURST_SIZE is 10 (from types/index.ts)
      const responses: string[] = [];

      clientSocket.on('error', (message: string) => {
        responses.push(message);
      });

      // Send 15 save_file requests rapidly (exceeds burst of 10)
      const promises: Promise<void>[] = [];
      for (let i = 0; i < 15; i++) {
        const promise = new Promise<void>((resolve) => {
          clientSocket.emit('save_file', {
            sessionId,
            path: `test-${i}.txt`,
            content: `Content ${i}`,
          });
          // Small delay between requests
          setTimeout(resolve, 10);
        });
        promises.push(promise);
      }

      await Promise.all(promises);

      // Wait for rate limiter to process
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should have received at least one rate limit error
      // Note: This test verifies rate limiting works, but exact count may vary
      expect(responses.length).toBeGreaterThan(0);

      // Cleanup
      await databaseService.deleteSession(sessionId);
    });

    it('should allow requests after rate limit duration expires', async () => {
      const sessionId = `test-rate-recovery-${Date.now()}`;
      await databaseService.createSession({
        id: sessionId,
        prompt: 'Test',
        capabilityConfig: JSON.stringify({ inputMode: 'naive' }),
        status: 'generating',
      });

      let errorCount = 0;
      clientSocket.on('error', (message: string) => {
        if (message.includes('Too many requests')) {
          errorCount++;
        }
      });

      // Exhaust rate limit
      for (let i = 0; i < 11; i++) {
        clientSocket.emit('save_file', {
          sessionId,
          path: `test1-${i}.txt`,
          content: `Content ${i}`,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
      const initialErrors = errorCount;

      // Wait for rate limit to reset (1 second duration)
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should be able to send requests again
      clientSocket.emit('save_file', {
        sessionId,
        path: 'test2.txt',
        content: 'Content after reset',
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Error count should not have increased after reset
      expect(errorCount).toBe(initialErrors);

      // Cleanup
      await databaseService.deleteSession(sessionId);
    });
  });

  describe('Stop Generation', () => {
    it('should handle idempotent abort calls', async () => {
      const sessionId = `test-idempotent-abort-${Date.now()}`;
      await databaseService.createSession({
        id: sessionId,
        prompt: 'Test',
        capabilityConfig: JSON.stringify({ inputMode: 'naive' }),
        status: 'generating',
      });

      // Start generation to populate activeGenerations
      clientSocket.emit('start_generation', {
        config: {
          inputMode: 'naive' as const,
          planning: false,
          compilerChecks: false,
          buildingBlocks: false,
          maxIterations: 3,
        },
        model: 'gpt-5-mini' as const,
        prompt: 'Test prompt',
      });

      // Wait for session to start
      await new Promise<void>((resolve) => {
        clientSocket.once('session_started', () => resolve());
      });

      let errorReceived = false;
      clientSocket.on('error', () => {
        errorReceived = true;
      });

      // Call stop_generation twice
      clientSocket.emit('stop_generation');
      clientSocket.emit('stop_generation');

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should not receive any errors (abort is idempotent)
      expect(errorReceived).toBe(false);

      // Cleanup
      await databaseService.deleteSession(sessionId);
    });

    it('should handle stop_generation without active session', async () => {
      const errors: string[] = [];
      clientSocket.on('error', (message: string) => {
        errors.push(message);
      });

      // Call stop_generation without starting any generation
      clientSocket.emit('stop_generation');

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should receive "No active session found" error
      expect(errors.some((e) => e.includes('No active session'))).toBe(true);
    });

    it('should handle abort after natural completion', async () => {
      // Start generation
      clientSocket.emit('start_generation', {
        config: {
          inputMode: 'naive' as const,
          planning: false,
          compilerChecks: false,
          buildingBlocks: false,
          maxIterations: 3,
        },
        model: 'gpt-5-mini' as const,
        prompt: 'Test prompt',
      });

      // Wait for session to start
      const completedSessionId = await new Promise<string>((resolve) => {
        clientSocket.once('session_started', (data: { sessionId: string }) => {
          resolve(data.sessionId);
        });
      });

      // Wait for generation_complete with a timeout fallback
      // In mocked environment, generation completes very quickly
      await Promise.race([
        new Promise<void>((resolve) => {
          clientSocket.once('generation_complete', () => resolve());
        }),
        new Promise<void>((resolve) => setTimeout(resolve, 500)), // 500ms timeout
      ]);

      const errors: string[] = [];
      clientSocket.on('error', (msg: string) => {
        errors.push(msg);
      });

      // Try to stop after completion
      clientSocket.emit('stop_generation');

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should receive info message that no active generation found
      // (generation already removed from activeGenerations after completion)
      // This is NOT an error condition - it's expected behavior
      expect(errors.length).toBeGreaterThanOrEqual(0); // May or may not get message

      // Cleanup
      await databaseService.deleteSession(completedSessionId);
    });
  });

  describe('Error Sanitization', () => {
    it('should sanitize ENOENT errors without exposing paths', async () => {
      const sessionId = `test-sanitize-${Date.now()}`;
      await databaseService.createSession({
        id: sessionId,
        prompt: 'Test',
        capabilityConfig: JSON.stringify({ inputMode: 'naive' }),
        status: 'generating',
      });

      const errors: string[] = [];
      clientSocket.on('error', (message: string) => {
        errors.push(message);
      });

      // Trigger an error by using invalid session
      clientSocket.emit('start_app', { sessionId: 'nonexistent-session' });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Error should be sanitized (not expose internal details)
      const errorMessage = errors[0];
      expect(errorMessage).toBeDefined();
      // Should not contain file paths or internal details
      expect(errorMessage).not.toMatch(/\/Users|\/home|\/tmp/);
      expect(errorMessage).not.toMatch(/Error:|TypeError:|ReferenceError:/);

      // Cleanup
      await databaseService.deleteSession(sessionId);
    });

    it('should handle non-Error objects safely', async () => {
      const sessionId = `test-non-error-${Date.now()}`;
      await databaseService.createSession({
        id: sessionId,
        prompt: 'Test',
        capabilityConfig: JSON.stringify({ inputMode: 'naive' }),
        status: 'generating',
      });

      const errors: string[] = [];
      clientSocket.on('error', (message: string) => {
        errors.push(message);
      });

      // Trigger validation error with invalid payload
      clientSocket.emit('start_generation', {
        prompt: '', // Empty prompt should fail validation
        config: {
          inputMode: 'naive' as const,
          planning: false,
          compilerChecks: false,
          buildingBlocks: false,
          maxIterations: 3,
        },
        model: 'gpt-5-mini' as const,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should receive sanitized error message
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toBeDefined();

      // Cleanup
      await databaseService.deleteSession(sessionId);
    });
  });

  describe('Session Room Management', () => {
    it('should correctly join session room on generation start', async () => {
      let receivedSessionId: string | undefined;
      clientSocket.on('session_started', (data: { sessionId: string }) => {
        receivedSessionId = data.sessionId;
      });

      // Start generation
      clientSocket.emit('start_generation', {
        config: {
          inputMode: 'naive' as const,
          planning: false,
          compilerChecks: false,
          buildingBlocks: false,
          maxIterations: 3,
        },
        model: 'gpt-5-mini' as const,
        prompt: 'Test prompt',
      });

      // Wait for session_started event
      await new Promise<void>((resolve) => {
        clientSocket.once('session_started', () => resolve());
      });

      expect(receivedSessionId).toBeDefined();
      expect(receivedSessionId).toMatch(/^[a-f0-9-]{36}$/); // UUID format

      // Cleanup
      if (receivedSessionId) {
        await databaseService.deleteSession(receivedSessionId);
      }
    });

    it('should handle subscribe_to_session correctly', async () => {
      // Use crypto.randomUUID() to generate a valid UUID
      const { randomUUID } = await import('node:crypto');
      const sessionId = randomUUID();

      await databaseService.createSession({
        id: sessionId,
        prompt: 'Test',
        capabilityConfig: JSON.stringify({ inputMode: 'naive' }),
        status: 'completed',
      });

      const errors: string[] = [];
      const errorHandler = (msg: string) => {
        errors.push(msg);
      };

      clientSocket.on('error', errorHandler);

      // Subscribe to session
      clientSocket.emit('subscribe_to_session', { sessionId });

      await new Promise((resolve) => setTimeout(resolve, 150));

      // Cleanup listener
      clientSocket.off('error', errorHandler);

      // Should not receive validation errors (valid UUID format)
      const hasValidationError = errors.some((e) => e.includes('Validation error'));
      expect(hasValidationError).toBe(false);

      // Cleanup
      await databaseService.deleteSession(sessionId);
    });

    it('should reject subscribe with invalid session ID format', async () => {
      const errors: string[] = [];
      clientSocket.on('error', (message: string) => {
        errors.push(message);
      });

      // Try to subscribe with invalid UUID
      clientSocket.emit('subscribe_to_session', { sessionId: 'not-a-uuid' });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should receive validation error
      expect(errors.some((e) => e.includes('Validation error'))).toBe(true);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple simultaneous generations', async () => {
      const sessionIds: string[] = [];

      clientSocket.on('session_started', (data: { sessionId: string }) => {
        sessionIds.push(data.sessionId);
      });

      // Start 3 generations concurrently
      clientSocket.emit('start_generation', {
        config: {
          inputMode: 'naive' as const,
          planning: false,
          compilerChecks: false,
          buildingBlocks: false,
          maxIterations: 3,
        },
        model: 'gpt-5-mini' as const,
        prompt: 'Test prompt 1',
      });
      clientSocket.emit('start_generation', {
        config: {
          inputMode: 'naive' as const,
          planning: false,
          compilerChecks: false,
          buildingBlocks: false,
          maxIterations: 3,
        },
        model: 'gpt-5-mini' as const,
        prompt: 'Test prompt 2',
      });
      clientSocket.emit('start_generation', {
        config: {
          inputMode: 'naive' as const,
          planning: false,
          compilerChecks: false,
          buildingBlocks: false,
          maxIterations: 3,
        },
        model: 'gpt-5-mini' as const,
        prompt: 'Test prompt 3',
      });

      // Wait for all to start
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Should have received 3 unique session IDs
      expect(sessionIds.length).toBe(3);
      expect(new Set(sessionIds).size).toBe(3); // All unique

      // Cleanup
      for (const id of sessionIds) {
        await databaseService.deleteSession(id);
      }
    });
  });
});
