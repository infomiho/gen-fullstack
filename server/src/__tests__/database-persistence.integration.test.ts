/**
 * Integration test for database persistence during generation
 *
 * Verifies that LLM messages, tool calls, and tool results are properly
 * persisted to the database as they're emitted via WebSocket.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { databaseService } from '../services/database.service.js';
import { NaiveStrategy } from '../strategies/naive.strategy.js';
import type { Server as SocketIOServer } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../types/index.js';

describe('Database Persistence Integration', () => {
  const testSessionId = `test-session-${Date.now()}`;

  beforeAll(async () => {
    // Initialize database
    await databaseService.initialize();

    // Create test session
    await databaseService.createSession({
      id: testSessionId,
      prompt: 'Create a simple counter app',
      strategy: 'naive',
      status: 'generating',
    });
  });

  afterAll(async () => {
    // Cleanup
    await databaseService.deleteSession(testSessionId);
  });

  it('should persist LLM messages when emitMessage is called', async () => {
    const strategy = new NaiveStrategy();

    // Mock Socket.IO server
    const mockIo = {
      to: () => ({
        emit: () => {},
      }),
    } as unknown as SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

    // Manually call setSessionId and emitMessage (simulating what happens during generation)
    (strategy as any).setSessionId(testSessionId);
    (strategy as any).emitMessage(mockIo, 'system', 'Test message 1');
    (strategy as any).emitMessage(mockIo, 'assistant', 'Test message 2');

    // Give database a moment to complete async operations
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Fetch timeline from database
    const timeline = await databaseService.getTimelineItems(testSessionId);

    // Filter for messages only
    const messages = timeline.filter((item) => item.type === 'message');

    // Verify messages were persisted
    expect(messages.length).toBeGreaterThanOrEqual(2);
    expect(messages.some((m) => m.content?.includes('Test message 1'))).toBe(true);
    expect(messages.some((m) => m.content?.includes('Test message 2'))).toBe(true);
  });

  it('should persist tool calls when emitToolCall is called', async () => {
    const strategy = new NaiveStrategy();

    const mockIo = {
      to: () => ({
        emit: () => {},
      }),
    } as unknown as SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

    (strategy as any).setSessionId(testSessionId);
    (strategy as any).emitToolCall(mockIo, 'tool-test-1', 'writeFile', {
      path: '/test.txt',
      content: 'test content',
    });

    // Give database a moment
    await new Promise((resolve) => setTimeout(resolve, 100));

    const timeline = await databaseService.getTimelineItems(testSessionId);
    const toolCalls = timeline.filter((item) => item.type === 'tool_call');

    expect(toolCalls.length).toBeGreaterThanOrEqual(1);
    expect(toolCalls.some((tc) => tc.toolName === 'writeFile')).toBe(true);
  });

  it('should persist tool results when emitToolResult is called', async () => {
    const strategy = new NaiveStrategy();

    const mockIo = {
      to: () => ({
        emit: () => {},
      }),
    } as unknown as SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

    (strategy as any).setSessionId(testSessionId);
    (strategy as any).emitToolResult(
      mockIo,
      'tool-test-1',
      'writeFile',
      'File written successfully',
    );

    // Give database a moment
    await new Promise((resolve) => setTimeout(resolve, 100));

    const timeline = await databaseService.getTimelineItems(testSessionId);
    const toolResults = timeline.filter((item) => item.type === 'tool_result');

    expect(toolResults.length).toBeGreaterThanOrEqual(1);
    expect(toolResults.some((tr) => tr.result?.includes('File written successfully'))).toBe(true);
  });

  it('should accumulate message content when same message ID is used (streaming)', async () => {
    const strategy = new NaiveStrategy();

    const mockIo = {
      to: () => ({
        emit: () => {},
      }),
    } as unknown as SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

    (strategy as any).setSessionId(testSessionId);

    // Simulate streaming by emitting multiple parts with the same role
    (strategy as any).emitMessage(mockIo, 'assistant', 'Hello ');
    (strategy as any).emitMessage(mockIo, 'assistant', 'world!');

    // Give database a moment
    await new Promise((resolve) => setTimeout(resolve, 100));

    const timeline = await databaseService.getTimelineItems(testSessionId);
    const assistantMessages = timeline.filter(
      (item) => item.type === 'message' && item.role === 'assistant',
    );

    // Should have accumulated the content into one message
    const lastMessage = assistantMessages[assistantMessages.length - 1];
    expect(lastMessage.content).toContain('Hello world!');
  });
});
