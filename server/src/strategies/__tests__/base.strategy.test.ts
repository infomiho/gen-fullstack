/**
 * Tests for BaseStrategy abort functionality
 */

import type { Server as SocketIOServer } from 'socket.io';
import { describe, expect, it, vi } from 'vitest';
import type { ClientToServerEvents, ServerToClientEvents } from '../../types/index.js';
import { BaseStrategy } from '../base.strategy.js';

// Create a concrete test implementation of BaseStrategy
class TestStrategy extends BaseStrategy {
  getName(): string {
    return 'Test';
  }

  getSystemPrompt(): string {
    return 'Test prompt';
  }

  async generateApp(): Promise<any> {
    // Simulate a long-running operation that can be aborted
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () =>
          resolve({
            totalTokens: 0,
            inputTokens: 0,
            outputTokens: 0,
            cost: 0,
            duration: 1000,
            steps: 1,
          }),
        5000,
      );

      // Check for abort every 100ms
      const checkAbort = setInterval(() => {
        if (this.isAborted()) {
          clearTimeout(timeout);
          clearInterval(checkAbort);
          const error: any = new Error('Aborted');
          error.name = 'AbortError';
          reject(error);
        }
      }, 100);
    });
  }
}

describe('BaseStrategy Abort Functionality', () => {
  it('should have abort controller initialized', () => {
    const strategy = new TestStrategy();
    expect(strategy.getAbortSignal()).toBeDefined();
    expect(strategy.isAborted()).toBe(false);
  });

  it('should abort ongoing operation', () => {
    const strategy = new TestStrategy();

    expect(strategy.isAborted()).toBe(false);

    strategy.abort();

    expect(strategy.isAborted()).toBe(true);
  });

  it('should handle double abort gracefully', () => {
    const strategy = new TestStrategy();

    strategy.abort();
    expect(strategy.isAborted()).toBe(true);

    // Second abort should not throw
    expect(() => strategy.abort()).not.toThrow();
    expect(strategy.isAborted()).toBe(true);
  });

  it('should detect AbortError in error handling', async () => {
    const strategy = new TestStrategy();

    // Create a proper mock for Socket.IO with to() and emit() methods
    const mockIo = {
      to: vi.fn().mockReturnValue({
        emit: vi.fn(),
      }),
    } as unknown as SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

    // Set session ID first (required for calculateMetrics)
    (strategy as any).setSessionId('test-session-123');

    // Create an AbortError
    const abortError: any = new Error('Operation aborted');
    abortError.name = 'AbortError';

    // Call handleGenerationError (it's protected, but we can test via TypeScript cast)
    const result = (strategy as any).handleGenerationError(mockIo, Date.now(), abortError);

    expect(result).toBeDefined();
    expect(result.totalTokens).toBe(0);
    expect(result.inputTokens).toBe(0);
  });

  it('should abort signal propagate to abort controller', () => {
    const strategy = new TestStrategy();
    const signal = strategy.getAbortSignal();

    expect(signal.aborted).toBe(false);

    strategy.abort();

    expect(signal.aborted).toBe(true);
  });
});
