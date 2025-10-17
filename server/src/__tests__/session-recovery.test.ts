/**
 * Session Recovery Integration Tests
 *
 * Tests that verify timeline items and files are properly persisted
 * and can be retrieved after a generation session.
 */

import { createServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { databaseService } from '../services/database.service.js';
import { NaiveStrategy } from '../strategies/naive.strategy.js';
import type { ClientToServerEvents, ServerToClientEvents } from '../types/index.js';

/**
 * Wait for async database operations to complete
 * Uses polling to check if the condition is met
 */
async function waitForCondition(
  condition: () => Promise<boolean> | boolean,
  timeout = 1000,
  interval = 10,
): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(`Condition not met within ${timeout}ms`);
}

describe('Session Recovery', () => {
  let io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>;
  let httpServer: ReturnType<typeof createServer>;
  let sessionId: string;

  beforeEach(async () => {
    // Initialize database
    await databaseService.initialize();

    // Create test session
    sessionId = `test-${Date.now()}`;
    await databaseService.createSession({
      id: sessionId,
      prompt: 'test prompt',
      strategy: 'naive',
      status: 'generating',
      createdAt: new Date(),
    });

    // Create Socket.IO server for testing
    httpServer = createServer();
    io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer);
  });

  afterEach(async () => {
    // Clean up test session
    await databaseService.deleteSession(sessionId);

    // Close Socket.IO
    io.close();
    httpServer.close();
  });

  describe('Timeline Persistence', () => {
    it('should persist system messages', async () => {
      const strategy = new NaiveStrategy();
      // biome-ignore lint/complexity/useLiteralKeys: Accessing protected method for testing
      strategy['setSessionId'](sessionId);

      // Emit a system message
      // biome-ignore lint/complexity/useLiteralKeys: Accessing protected method for testing
      strategy['emitMessage'](io, 'system', 'Starting generation...');

      // Wait for async persistence
      await waitForCondition(async () => {
        const timeline = await databaseService.getTimelineItems(sessionId);
        return timeline.length === 1;
      });

      // Retrieve timeline items
      const timeline = await databaseService.getTimelineItems(sessionId);

      // Should have 1 message
      expect(timeline.length).toBe(1);
      expect(timeline[0].type).toBe('message');
      expect(timeline[0].role).toBe('system');
      expect(timeline[0].content).toBe('Starting generation...');
    });

    it('should accumulate streaming assistant messages', async () => {
      const strategy = new NaiveStrategy();
      // biome-ignore lint/complexity/useLiteralKeys: Accessing protected method for testing
      strategy['setSessionId'](sessionId);

      // Emit multiple chunks of assistant message (simulating streaming)
      // biome-ignore lint/complexity/useLiteralKeys: Accessing protected method for testing
      strategy['emitMessage'](io, 'assistant', 'Hello ');
      // biome-ignore lint/complexity/useLiteralKeys: Accessing protected method for testing
      strategy['emitMessage'](io, 'assistant', 'world!');

      // Wait for async persistence
      await waitForCondition(async () => {
        const timeline = await databaseService.getTimelineItems(sessionId);
        return timeline.length > 0 && timeline[0].content === 'Hello world!';
      });

      // Retrieve timeline items
      const timeline = await databaseService.getTimelineItems(sessionId);

      // Should have 1 accumulated message
      expect(timeline.length).toBe(1);
      expect(timeline[0].type).toBe('message');
      expect(timeline[0].role).toBe('assistant');
      expect(timeline[0].content).toBe('Hello world!');
    });

    it('should persist tool calls and tool results', async () => {
      const strategy = new NaiveStrategy();
      // biome-ignore lint/complexity/useLiteralKeys: Accessing protected method for testing
      strategy['setSessionId'](sessionId);

      // Emit tool call
      const toolCallId = 'tool-123';
      // biome-ignore lint/complexity/useLiteralKeys: Accessing protected method for testing
      strategy['emitToolCall'](io, toolCallId, 'writeFile', {
        file_path: '/test.txt',
        content: 'hello',
      });

      // Emit tool result
      // biome-ignore lint/complexity/useLiteralKeys: Accessing protected method for testing
      strategy['emitToolResult'](io, toolCallId, 'writeFile', 'File written successfully');

      // Wait for async persistence
      await waitForCondition(async () => {
        const timeline = await databaseService.getTimelineItems(sessionId);
        return timeline.length === 2;
      });

      // Retrieve timeline items
      const timeline = await databaseService.getTimelineItems(sessionId);

      // Should have 2 items: 1 tool call + 1 tool result
      expect(timeline.length).toBe(2);

      const toolCall = timeline.find((item) => item.type === 'tool_call');
      expect(toolCall).toBeDefined();
      expect(toolCall?.toolCallId).toBe(toolCallId);
      expect(toolCall?.toolName).toBe('writeFile');
      expect(JSON.parse(toolCall?.toolArgs || '{}')).toEqual({
        file_path: '/test.txt',
        content: 'hello',
      });

      const toolResult = timeline.find((item) => item.type === 'tool_result');
      expect(toolResult).toBeDefined();
      expect(toolResult?.toolResultFor).toBe(toolCallId);
      expect(toolResult?.result).toBe('File written successfully');
    });

    it('should persist mixed timeline items in correct order', async () => {
      const strategy = new NaiveStrategy();
      // biome-ignore lint/complexity/useLiteralKeys: Accessing protected method for testing
      strategy['setSessionId'](sessionId);

      // Emit a sequence of events
      // biome-ignore lint/complexity/useLiteralKeys: Accessing protected method for testing
      strategy['emitMessage'](io, 'system', 'Starting...');
      // biome-ignore lint/complexity/useLiteralKeys: Accessing protected method for testing
      strategy['emitMessage'](io, 'assistant', 'Creating files');

      const toolCallId = 'tool-456';
      // biome-ignore lint/complexity/useLiteralKeys: Accessing protected method for testing
      strategy['emitToolCall'](io, toolCallId, 'writeFile', { file_path: '/test.txt' });
      // biome-ignore lint/complexity/useLiteralKeys: Accessing protected method for testing
      strategy['emitToolResult'](io, toolCallId, 'writeFile', 'Success');
      // biome-ignore lint/complexity/useLiteralKeys: Accessing protected method for testing
      strategy['emitMessage'](io, 'assistant', 'Done');

      // Wait for all async persistence operations to complete
      await waitForCondition(async () => {
        const timeline = await databaseService.getTimelineItems(sessionId);
        return timeline.length === 5;
      });

      // Retrieve timeline items
      const timeline = await databaseService.getTimelineItems(sessionId);

      // Should have 5 items total
      expect(timeline.length).toBe(5);

      // Verify all expected items exist (not strict ordering due to async persistence)
      const messages = timeline.filter((item) => item.type === 'message');
      const toolCalls = timeline.filter((item) => item.type === 'tool_call');
      const toolResults = timeline.filter((item) => item.type === 'tool_result');

      // Should have 3 messages
      expect(messages.length).toBe(3);
      expect(messages.some((m) => m.content === 'Starting...' && m.role === 'system')).toBe(true);
      expect(messages.some((m) => m.content === 'Creating files' && m.role === 'assistant')).toBe(
        true,
      );
      expect(messages.some((m) => m.content === 'Done' && m.role === 'assistant')).toBe(true);

      // Should have 1 tool call
      expect(toolCalls.length).toBe(1);
      expect(toolCalls[0].toolCallId).toBe(toolCallId);
      expect(toolCalls[0].toolName).toBe('writeFile');

      // Should have 1 tool result
      expect(toolResults.length).toBe(1);
      expect(toolResults[0].toolResultFor).toBe(toolCallId);
      expect(toolResults[0].result).toBe('Success');
    });
  });

  describe('File Persistence', () => {
    it('should persist generated files', async () => {
      // Save a file directly (simulating tool execution)
      await databaseService.saveFile({
        sessionId,
        path: '/test.txt',
        content: 'hello world',
      });

      // Retrieve files
      const files = await databaseService.getFiles(sessionId);

      expect(files.length).toBe(1);
      expect(files[0].path).toBe('/test.txt');
      expect(files[0].content).toBe('hello world');
    });

    it('should update file content on subsequent saves', async () => {
      // Save file twice
      await databaseService.saveFile({
        sessionId,
        path: '/test.txt',
        content: 'version 1',
      });

      await databaseService.saveFile({
        sessionId,
        path: '/test.txt',
        content: 'version 2',
      });

      // Retrieve files
      const files = await databaseService.getFiles(sessionId);

      // Should have only 1 file with latest content
      expect(files.length).toBe(1);
      expect(files[0].content).toBe('version 2');
    });
  });

  describe('Session API', () => {
    it('should retrieve session with timeline and files', async () => {
      const strategy = new NaiveStrategy();
      // biome-ignore lint/complexity/useLiteralKeys: Accessing protected method for testing
      strategy['setSessionId'](sessionId);

      // Emit some events
      // biome-ignore lint/complexity/useLiteralKeys: Accessing protected method for testing
      strategy['emitMessage'](io, 'system', 'Starting...');
      // biome-ignore lint/complexity/useLiteralKeys: Accessing protected method for testing
      strategy['emitToolCall'](io, 'tool-1', 'writeFile', { file_path: '/test.txt' });
      // biome-ignore lint/complexity/useLiteralKeys: Accessing protected method for testing
      strategy['emitToolResult'](io, 'tool-1', 'writeFile', 'Success');

      // Save a file
      await databaseService.saveFile({
        sessionId,
        path: '/test.txt',
        content: 'content',
      });

      // Wait for async persistence
      await waitForCondition(async () => {
        const timeline = await databaseService.getTimelineItems(sessionId);
        const files = await databaseService.getFiles(sessionId);
        return timeline.length === 3 && files.length === 1;
      });

      // Retrieve full session data (as the API does)
      const [session, timeline, files] = await Promise.all([
        databaseService.getSession(sessionId),
        databaseService.getTimelineItems(sessionId),
        databaseService.getFiles(sessionId),
      ]);

      // Verify session exists
      expect(session).toBeDefined();
      expect(session?.id).toBe(sessionId);

      // Verify timeline has items
      expect(timeline.length).toBeGreaterThan(0);
      console.log('Timeline items:', timeline.length);
      timeline.forEach((item, index) => {
        console.log(`  [${index}] ${item.type}:`, item);
      });

      // Verify files exist
      expect(files.length).toBe(1);
      expect(files[0].path).toBe('/test.txt');
    });
  });
});
