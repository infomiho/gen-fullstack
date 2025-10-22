import { describe, expect, it, vi } from 'vitest';
import type { Server as SocketIOServer } from 'socket.io';
import { CapabilityOrchestrator } from '../orchestrator/capability-orchestrator.js';
import { getActiveGenerations } from '../websocket.js';
import type { ClientToServerEvents, ServerToClientEvents } from '../types/index.js';

describe('SIGTERM Graceful Abort', () => {
  it('should provide access to active generations map', () => {
    const activeGenerations = getActiveGenerations();

    // Should return a Map
    expect(activeGenerations).toBeInstanceOf(Map);
  });

  it('should abort all active generations on SIGTERM', async () => {
    // Create mock orchestrators
    const mockIo = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    } as unknown as SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

    const orchestrator1 = new CapabilityOrchestrator('gpt-5-nano', mockIo);
    const orchestrator2 = new CapabilityOrchestrator('gpt-5-nano', mockIo);
    const orchestrator3 = new CapabilityOrchestrator('gpt-5-nano', mockIo);

    // Add to active generations map
    const activeGenerations = getActiveGenerations();
    activeGenerations.set('session-1', orchestrator1);
    activeGenerations.set('session-2', orchestrator2);
    activeGenerations.set('session-3', orchestrator3);

    // Verify none are aborted initially
    expect(orchestrator1.isAborted()).toBe(false);
    expect(orchestrator2.isAborted()).toBe(false);
    expect(orchestrator3.isAborted()).toBe(false);

    // Simulate SIGTERM handler - abort all generations
    for (const [, orchestrator] of activeGenerations.entries()) {
      orchestrator.abort();
    }

    // Verify all are aborted
    expect(orchestrator1.isAborted()).toBe(true);
    expect(orchestrator2.isAborted()).toBe(true);
    expect(orchestrator3.isAborted()).toBe(true);

    // Clean up
    activeGenerations.clear();
  });

  it('should handle empty active generations map gracefully', () => {
    const activeGenerations = getActiveGenerations();
    activeGenerations.clear();

    // Should not throw when iterating over empty map
    expect(() => {
      for (const [, orchestrator] of activeGenerations.entries()) {
        orchestrator.abort();
      }
    }).not.toThrow();

    expect(activeGenerations.size).toBe(0);
  });

  it('should allow orchestrators to be added and removed from active generations', () => {
    const mockIo = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    } as unknown as SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

    const orchestrator = new CapabilityOrchestrator('gpt-5-nano', mockIo);
    const activeGenerations = getActiveGenerations();

    // Add
    activeGenerations.set('test-session', orchestrator);
    expect(activeGenerations.size).toBeGreaterThan(0);
    expect(activeGenerations.has('test-session')).toBe(true);

    // Remove
    activeGenerations.delete('test-session');
    expect(activeGenerations.has('test-session')).toBe(false);
  });

  it('should maintain separate state for each orchestrator during abort', () => {
    const mockIo = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    } as unknown as SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

    const orchestrator1 = new CapabilityOrchestrator('gpt-5-nano', mockIo);
    const orchestrator2 = new CapabilityOrchestrator('gpt-5-nano', mockIo);

    const activeGenerations = getActiveGenerations();
    activeGenerations.set('session-1', orchestrator1);
    activeGenerations.set('session-2', orchestrator2);

    // Abort only session-1
    const session1Orchestrator = activeGenerations.get('session-1');
    session1Orchestrator?.abort();

    // Verify only session-1 is aborted
    expect(orchestrator1.isAborted()).toBe(true);
    expect(orchestrator2.isAborted()).toBe(false);

    // Clean up
    activeGenerations.delete('session-1');
    activeGenerations.delete('session-2');
  });
});
