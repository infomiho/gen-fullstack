/**
 * Template Strategy Tests
 *
 * Tests template-based generation strategy with template copying.
 */

import { EventEmitter } from 'node:events';
import type { Server as SocketIOServer } from 'socket.io';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientToServerEvents, ServerToClientEvents } from '../../types/index.js';
import { TemplateStrategy } from '../template.strategy.js';

// Mock the database service to avoid foreign key constraints
vi.mock('../../services/database.service.js', () => ({
  databaseService: {
    createSession: vi.fn(() => Promise.resolve()),
    upsertMessage: vi.fn(() => Promise.resolve()),
    addTimelineItem: vi.fn(() => Promise.resolve()),
    addToolResult: vi.fn(() => Promise.resolve()),
    updateSession: vi.fn(() => Promise.resolve()),
    getSession: vi.fn(() => Promise.resolve(null)),
    saveFile: vi.fn(() => Promise.resolve()),
  },
}));

// Mock the filesystem service
vi.mock('../../services/filesystem.service.js', async () => {
  const actual = await vi.importActual<typeof import('../../services/filesystem.service.js')>(
    '../../services/filesystem.service.js',
  );
  return {
    ...actual,
    copyTemplateToSandbox: vi.fn().mockResolvedValue(15), // Mock to return 15 files copied
    getAllFiles: vi.fn().mockResolvedValue([
      { relativePath: 'package.json', content: '{}' },
      { relativePath: 'client/src/App.tsx', content: 'export default function App() {}' },
    ]),
  };
});

// Mock the AI SDK
vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');

  // Create a generator function that can be called multiple times
  const createFullStream = () =>
    (async function* () {
      yield { type: 'text-delta', text: 'Customizing template...' };
      yield { type: 'finish' };
    })();

  return {
    ...actual,
    streamText: vi.fn(() => ({
      fullStream: createFullStream(),
      usage: Promise.resolve({ inputTokens: 100, outputTokens: 50 }),
      steps: Promise.resolve([{ toolCalls: [], text: 'Done' }]),
    })),
    stepCountIs: vi.fn((max: number) => max),
  };
});

// Create a mock Socket.IO server
function createMockIO(): SocketIOServer<ClientToServerEvents, ServerToClientEvents> {
  const emitter = new EventEmitter();
  const mockEmit = vi.fn();
  return {
    ...emitter,
    emit: mockEmit,
    on: emitter.on.bind(emitter),
    to: vi.fn().mockReturnValue({ emit: mockEmit }),
  } as unknown as SocketIOServer<ClientToServerEvents, ServerToClientEvents>;
}

describe('TemplateStrategy', () => {
  let strategy: TemplateStrategy;
  let mockIO: SocketIOServer<ClientToServerEvents, ServerToClientEvents>;

  beforeEach(() => {
    strategy = new TemplateStrategy();
    mockIO = createMockIO();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getName', () => {
    it('should return correct strategy name', () => {
      expect(strategy.getName()).toBe('Template-Based');
    });
  });

  describe('getSystemPrompt', () => {
    it('should return template-aware system prompt', () => {
      const prompt = strategy.getSystemPrompt();

      // Should mention template
      expect(prompt).toContain('template');
      expect(prompt).toContain('implement');

      // Should mention pre-existing structure
      expect(prompt).toContain('TEMPLATE STRUCTURE');
      expect(prompt).toContain('client/');
      expect(prompt).toContain('server/');
      expect(prompt).toContain('prisma/');

      // Should provide workflow guidance
      expect(prompt).toContain('EFFICIENT WORKFLOW');
      expect(prompt).toContain('readFile');
      expect(prompt).toContain('listFiles');

      // Should include concrete example
      expect(prompt).toContain('EXAMPLE - Task Tracker App');
      expect(prompt).toContain('Task model');

      // Should emphasize building over exploration
      expect(prompt).toContain('requirements');
    });
  });

  describe('generateApp', () => {
    it('should copy template before generation', async () => {
      const sessionId = 'test-session-template';
      const prompt = 'Build a task manager';

      const { copyTemplateToSandbox } = await import('../../services/filesystem.service.js');

      await strategy.generateApp(prompt, mockIO, sessionId);

      // Verify template was copied
      expect(copyTemplateToSandbox).toHaveBeenCalledWith(sessionId, 'vite-fullstack-base');
    });

    it('should emit status messages about template', async () => {
      const sessionId = 'test-session-template';
      const prompt = 'Build a blog';

      await strategy.generateApp(prompt, mockIO, sessionId);

      // Should emit message about copying template
      expect(mockIO.emit).toHaveBeenCalledWith(
        'llm_message',
        expect.objectContaining({
          role: 'system',
          content: expect.stringContaining('Copying full-stack template'),
        }),
      );

      // Should emit message showing what was copied
      expect(mockIO.emit).toHaveBeenCalledWith(
        'llm_message',
        expect.objectContaining({
          role: 'assistant',
          content: expect.stringContaining('Template Strategy'),
        }),
      );

      // Should mention files were copied (number may vary based on mock)
      expect(mockIO.emit).toHaveBeenCalledWith(
        'llm_message',
        expect.objectContaining({
          content: expect.stringContaining('files copied'),
        }),
      );
    });

    it('should use correct max tool calls limit', async () => {
      const sessionId = 'test-session-limits';
      const prompt = 'Build a social network';

      const { stepCountIs } = await import('ai');

      await strategy.generateApp(prompt, mockIO, sessionId);

      // Template strategy should use 15 max tool calls (fewer than naive)
      expect(stepCountIs).toHaveBeenCalledWith(15);
    });

    it('should return generation metrics', async () => {
      const sessionId = 'test-session-metrics';
      const prompt = 'Build a dashboard';

      const metrics = await strategy.generateApp(prompt, mockIO, sessionId);

      expect(metrics).toEqual({
        sessionId: 'test-session-metrics',
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
        cost: expect.any(Number), // Cost is calculated
        duration: expect.any(Number),
        steps: 1,
      });
    });

    it('should emit completion event with metrics', async () => {
      const sessionId = 'test-session-complete';
      const prompt = 'Build a portfolio site';

      await strategy.generateApp(prompt, mockIO, sessionId);

      // Should emit generation_complete
      expect(mockIO.emit).toHaveBeenCalledWith(
        'generation_complete',
        expect.objectContaining({
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          duration: expect.any(Number),
          steps: 1,
        }),
      );
    });

    it('should handle template copy errors gracefully', async () => {
      const sessionId = 'test-session-error';
      const prompt = 'Build an app';

      const { copyTemplateToSandbox } = await import('../../services/filesystem.service.js');
      vi.mocked(copyTemplateToSandbox).mockRejectedValueOnce(
        new Error('Template not found: vite-fullstack-base'),
      );

      const metrics = await strategy.generateApp(prompt, mockIO, sessionId);

      // Should return partial metrics on error
      expect(metrics.inputTokens).toBe(0);
      expect(metrics.outputTokens).toBe(0);
      expect(metrics.duration).toBeGreaterThanOrEqual(0); // Duration may be 0 in tests

      // Should emit error
      expect(mockIO.emit).toHaveBeenCalledWith(
        'error',
        expect.stringContaining('Template not found'),
      );
    });
  });
});
