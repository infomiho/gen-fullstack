import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server as SocketIOServer } from 'socket.io';
import { databaseService } from '../../services/database.service.js';
import type { ClientToServerEvents, ServerToClientEvents } from '../../types/index.js';
import { cleanupSession, emitPersistedMessage, resetMessageTracking } from '../message-utils.js';

// Mock dependencies
vi.mock('../../services/database.service.js', () => ({
  databaseService: {
    upsertMessage: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../retry-utils.js', () => ({
  retryOperation: vi.fn((fn) => fn()),
}));

describe('message-utils', () => {
  let mockIo: SocketIOServer<ClientToServerEvents, ServerToClientEvents>;
  const sessionId = 'test-session-123';

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Socket.IO server
    mockIo = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    } as unknown as SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

    // Clean up any existing trackers
    cleanupSession(sessionId);
  });

  describe('emitPersistedMessage', () => {
    it('should emit message to WebSocket with correct structure', () => {
      const role = 'system';
      const content = 'Test message';

      emitPersistedMessage(sessionId, mockIo, role, content);

      expect(mockIo.to).toHaveBeenCalledWith(sessionId);
      expect(mockIo.emit).toHaveBeenCalledWith(
        'llm_message',
        expect.objectContaining({
          id: expect.stringMatching(/^msg-[a-f0-9-]+$/), // UUID format
          role,
          content,
          timestamp: expect.any(Number),
        }),
      );
    });

    it('should persist message to database via upsertMessage', () => {
      const role = 'assistant';
      const content = 'Assistant response';

      emitPersistedMessage(sessionId, mockIo, role, content);

      expect(databaseService.upsertMessage).toHaveBeenCalledWith(
        sessionId,
        expect.stringMatching(/^msg-[a-f0-9-]+$/),
        role,
        content,
        expect.any(Date),
      );
    });

    it('should generate unique message IDs for system messages', () => {
      emitPersistedMessage(sessionId, mockIo, 'system', 'First system message');
      const firstCallId = (mockIo.emit as ReturnType<typeof vi.fn>).mock.calls[0][1].id;

      emitPersistedMessage(sessionId, mockIo, 'system', 'Second system message');
      const secondCallId = (mockIo.emit as ReturnType<typeof vi.fn>).mock.calls[1][1].id;

      expect(firstCallId).not.toBe(secondCallId);
    });

    it('should reuse message ID for consecutive assistant messages', () => {
      emitPersistedMessage(sessionId, mockIo, 'assistant', 'First chunk');
      const firstCallId = (mockIo.emit as ReturnType<typeof vi.fn>).mock.calls[0][1].id;

      emitPersistedMessage(sessionId, mockIo, 'assistant', ' second chunk');
      const secondCallId = (mockIo.emit as ReturnType<typeof vi.fn>).mock.calls[1][1].id;

      expect(firstCallId).toBe(secondCallId);
    });

    it('should generate new message ID when role changes', () => {
      emitPersistedMessage(sessionId, mockIo, 'assistant', 'Assistant message');
      const assistantId = (mockIo.emit as ReturnType<typeof vi.fn>).mock.calls[0][1].id;

      emitPersistedMessage(sessionId, mockIo, 'user', 'User message');
      const userId = (mockIo.emit as ReturnType<typeof vi.fn>).mock.calls[1][1].id;

      expect(assistantId).not.toBe(userId);
    });

    it('should handle missing io gracefully', () => {
      expect(() => {
        emitPersistedMessage(sessionId, undefined, 'system', 'Test message');
      }).not.toThrow();

      // Should still persist to database
      expect(databaseService.upsertMessage).toHaveBeenCalled();
    });

    it('should not throw if database persistence fails', async () => {
      // Mock database failure
      vi.mocked(databaseService.upsertMessage).mockRejectedValueOnce(new Error('Database error'));

      expect(() => {
        emitPersistedMessage(sessionId, mockIo, 'system', 'Test message');
      }).not.toThrow();

      // WebSocket emit should still happen
      expect(mockIo.emit).toHaveBeenCalled();
    });

    it('should handle multiple sessions independently', () => {
      const session1 = 'session-1';
      const session2 = 'session-2';

      emitPersistedMessage(session1, mockIo, 'assistant', 'Message in session 1');
      const session1Id = (mockIo.emit as ReturnType<typeof vi.fn>).mock.calls[0][1].id;

      emitPersistedMessage(session2, mockIo, 'assistant', 'Message in session 2');
      const session2Id = (mockIo.emit as ReturnType<typeof vi.fn>).mock.calls[1][1].id;

      // Different sessions should have different message IDs
      expect(session1Id).not.toBe(session2Id);

      // Continuing in session 1 should reuse the same ID
      emitPersistedMessage(session1, mockIo, 'assistant', ' more content');
      const session1ContinuedId = (mockIo.emit as ReturnType<typeof vi.fn>).mock.calls[2][1].id;
      expect(session1ContinuedId).toBe(session1Id);
    });
  });

  describe('resetMessageTracking', () => {
    it('should reset message ID tracking for a session', () => {
      emitPersistedMessage(sessionId, mockIo, 'assistant', 'First message');
      const firstId = (mockIo.emit as ReturnType<typeof vi.fn>).mock.calls[0][1].id;

      resetMessageTracking(sessionId);

      emitPersistedMessage(sessionId, mockIo, 'assistant', 'Second message after reset');
      const secondId = (mockIo.emit as ReturnType<typeof vi.fn>).mock.calls[1][1].id;

      expect(firstId).not.toBe(secondId);
    });

    it('should handle step-based reset pattern (multiple messages before reset)', () => {
      // Simulate a generation step with text before tool calls
      emitPersistedMessage(sessionId, mockIo, 'assistant', "I'll check the weather");
      const preToolMessageId = (mockIo.emit as ReturnType<typeof vi.fn>).mock.calls[0][1].id;

      // Continue streaming in same step (should reuse ID)
      emitPersistedMessage(sessionId, mockIo, 'assistant', ' for you');
      const continuedMessageId = (mockIo.emit as ReturnType<typeof vi.fn>).mock.calls[1][1].id;

      expect(continuedMessageId).toBe(preToolMessageId); // Same step, same ID

      // Step completes with tool calls → reset happens (simulating onStepFinish)
      resetMessageTracking(sessionId);

      // Next step: text after tool execution
      emitPersistedMessage(sessionId, mockIo, 'assistant', 'The weather is sunny');
      const postToolMessageId = (mockIo.emit as ReturnType<typeof vi.fn>).mock.calls[2][1].id;

      // Should have NEW ID after reset
      expect(postToolMessageId).not.toBe(preToolMessageId);
    });

    it('should not affect other sessions', () => {
      const session1 = 'session-1';
      const session2 = 'session-2';

      emitPersistedMessage(session1, mockIo, 'assistant', 'Session 1 message');
      const session1FirstId = (mockIo.emit as ReturnType<typeof vi.fn>).mock.calls[0][1].id;

      emitPersistedMessage(session2, mockIo, 'assistant', 'Session 2 message');

      // Reset session 1
      resetMessageTracking(session1);

      // Session 2 should still reuse its message ID
      emitPersistedMessage(session2, mockIo, 'assistant', ' continued');
      const session2ContinuedId = (mockIo.emit as ReturnType<typeof vi.fn>).mock.calls[2][1].id;
      const session2FirstId = (mockIo.emit as ReturnType<typeof vi.fn>).mock.calls[1][1].id;
      expect(session2ContinuedId).toBe(session2FirstId);

      // Session 1 should get a new ID
      emitPersistedMessage(session1, mockIo, 'assistant', 'Session 1 after reset');
      const session1AfterResetId = (mockIo.emit as ReturnType<typeof vi.fn>).mock.calls[3][1].id;
      expect(session1AfterResetId).not.toBe(session1FirstId);
    });
  });

  describe('cleanupSession', () => {
    it('should remove tracker from memory', () => {
      emitPersistedMessage(sessionId, mockIo, 'assistant', 'First message');
      const firstId = (mockIo.emit as ReturnType<typeof vi.fn>).mock.calls[0][1].id;

      cleanupSession(sessionId);

      // After cleanup, a new message should get a new tracker with a new ID
      emitPersistedMessage(sessionId, mockIo, 'assistant', 'Message after cleanup');
      const afterCleanupId = (mockIo.emit as ReturnType<typeof vi.fn>).mock.calls[1][1].id;

      expect(firstId).not.toBe(afterCleanupId);
    });

    it('should not throw if session does not exist', () => {
      expect(() => {
        cleanupSession('non-existent-session');
      }).not.toThrow();
    });
  });

  describe('concurrent writes', () => {
    it('should handle rapid concurrent messages without data loss', async () => {
      const numMessages = 50;
      const promises: Promise<void>[] = [];

      // Emit 50 rapid messages concurrently
      for (let i = 0; i < numMessages; i++) {
        const promise = Promise.resolve(
          emitPersistedMessage(sessionId, mockIo, 'assistant', `Chunk ${i}`),
        );
        promises.push(promise);
      }

      await Promise.all(promises);

      // Verify all messages were attempted to be persisted
      expect(databaseService.upsertMessage).toHaveBeenCalledTimes(numMessages);

      // Verify WebSocket emitted all messages
      expect(mockIo.emit).toHaveBeenCalledTimes(numMessages);

      // Verify messages used same ID (streaming behavior)
      const firstCallId = (mockIo.emit as ReturnType<typeof vi.fn>).mock.calls[0][1].id;
      const lastCallId = (mockIo.emit as ReturnType<typeof vi.fn>).mock.calls[numMessages - 1][1]
        .id;
      expect(firstCallId).toBe(lastCallId); // Same ID for consecutive assistant messages
    });

    it('should handle interleaved messages from multiple sessions', async () => {
      const session1 = 'session-1';
      const session2 = 'session-2';
      const numMessagesPerSession = 25;
      const promises: Promise<void>[] = [];

      // Interleave messages from two sessions
      for (let i = 0; i < numMessagesPerSession; i++) {
        promises.push(
          Promise.resolve(emitPersistedMessage(session1, mockIo, 'assistant', `S1-${i}`)),
        );
        promises.push(
          Promise.resolve(emitPersistedMessage(session2, mockIo, 'assistant', `S2-${i}`)),
        );
      }

      await Promise.all(promises);

      // Verify total calls
      expect(databaseService.upsertMessage).toHaveBeenCalledTimes(numMessagesPerSession * 2);

      // Verify sessions have different message IDs
      const session1Calls = (mockIo.emit as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call: unknown[]) =>
          call[1] &&
          typeof call[1] === 'object' &&
          'content' in call[1] &&
          typeof call[1].content === 'string' &&
          call[1].content.startsWith('S1-'),
      );
      const session2Calls = (mockIo.emit as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call: unknown[]) =>
          call[1] &&
          typeof call[1] === 'object' &&
          'content' in call[1] &&
          typeof call[1].content === 'string' &&
          call[1].content.startsWith('S2-'),
      );

      expect(session1Calls.length).toBe(numMessagesPerSession);
      expect(session2Calls.length).toBe(numMessagesPerSession);

      // Different sessions should have different message IDs
      const session1Id = session1Calls[0][1].id;
      const session2Id = session2Calls[0][1].id;
      expect(session1Id).not.toBe(session2Id);
    });
  });
});
