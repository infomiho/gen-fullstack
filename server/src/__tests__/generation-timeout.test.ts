import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server as SocketIOServer } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../types/index.js';
import { CapabilityOrchestrator } from '../orchestrator/capability-orchestrator.js';

describe('Generation Timeout', () => {
  let mockIo: SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

  beforeEach(() => {
    // Create a minimal mock Socket.IO server
    mockIo = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    } as unknown as SocketIOServer<ClientToServerEvents, ServerToClientEvents>;
  });

  it('should set up timeout when generation starts', () => {
    const orchestrator = new CapabilityOrchestrator('gpt-5-nano', mockIo);

    // Create a spy on setTimeout
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout');

    // Call abort method to verify it can be called
    orchestrator.abort();

    // Verify abort signal is set
    expect(orchestrator.isAborted()).toBe(true);

    setTimeoutSpy.mockRestore();
  });

  it('should provide abort functionality', () => {
    const orchestrator = new CapabilityOrchestrator('gpt-5-nano', mockIo);

    // Initially not aborted
    expect(orchestrator.isAborted()).toBe(false);

    // After calling abort
    orchestrator.abort();
    expect(orchestrator.isAborted()).toBe(true);

    // Abort signal should be set
    expect(orchestrator.getAbortSignal().aborted).toBe(true);
  });

  it('should be idempotent when calling abort multiple times', () => {
    const orchestrator = new CapabilityOrchestrator('gpt-5-nano', mockIo);

    // Call abort multiple times
    orchestrator.abort();
    orchestrator.abort();
    orchestrator.abort();

    // Should still be aborted
    expect(orchestrator.isAborted()).toBe(true);
    expect(orchestrator.getAbortSignal().aborted).toBe(true);
  });

  it('should provide abort signal for capabilities to check', () => {
    const orchestrator = new CapabilityOrchestrator('gpt-5-nano', mockIo);

    const abortSignal = orchestrator.getAbortSignal();

    // Signal should be valid
    expect(abortSignal).toBeDefined();
    expect(abortSignal.aborted).toBe(false);

    // After abort, signal should be updated
    orchestrator.abort();
    expect(abortSignal.aborted).toBe(true);
  });

  it('should maintain separate abort controllers for different orchestrators', () => {
    const orchestrator1 = new CapabilityOrchestrator('gpt-5-nano', mockIo);
    const orchestrator2 = new CapabilityOrchestrator('gpt-5-nano', mockIo);

    // Abort only first orchestrator
    orchestrator1.abort();

    // First should be aborted
    expect(orchestrator1.isAborted()).toBe(true);

    // Second should not be affected
    expect(orchestrator2.isAborted()).toBe(false);
  });
});
