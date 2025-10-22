/**
 * Reusable Test Mocks
 *
 * Centralized mock factories for integration tests to avoid duplication
 * and ensure consistent test behavior.
 *
 * IMPORTANT: Vitest requires vi.mock() calls at module top-level (before imports).
 * This file provides reusable factory functions and configurations that can be
 * copied into your test files. See examples below.
 *
 * @example Copy this into your test file
 * ```typescript
 * import { createMockIO } from './helpers/test-mocks.js';
 *
 * // Mock filesystem service
 * vi.mock('../services/filesystem.service.js', () => ({
 *   initializeSandbox: vi.fn().mockResolvedValue('/tmp/test-sandbox'),
 *   copyTemplateToSandbox: vi.fn().mockResolvedValue(15),
 *   getAllFiles: vi.fn().mockResolvedValue([]),
 *   getSandboxPath: vi.fn((sessionId: string) => `/tmp/sandbox-${sessionId}`),
 *   writeFile: vi.fn().mockResolvedValue(undefined),
 * }));
 *
 * // Mock command service
 * vi.mock('../services/command.service.js', () => ({
 *   executeCommand: vi.fn().mockResolvedValue({
 *     success: true,
 *     stdout: '',
 *     stderr: '',
 *     exitCode: 0,
 *   }),
 *   getAllowedCommands: vi.fn().mockReturnValue(['npm', 'npx', 'node', ...]),
 * }));
 *
 * // Mock AI SDK
 * vi.mock('ai', async () => {
 *   const actual = await vi.importActual<typeof import('ai')>('ai');
 *   return {
 *     ...actual,
 *     streamText: vi.fn(() => ({
 *       fullStream: (async function* () {
 *         yield { type: 'text-delta', text: 'Test response' };
 *         yield { type: 'finish' };
 *       })(),
 *       usage: Promise.resolve({ inputTokens: 100, outputTokens: 50 }),
 *       steps: Promise.resolve([{ toolCalls: [], text: 'Done' }]),
 *     })),
 *     generateText: vi.fn(() =>
 *       Promise.resolve({
 *         text: 'Test plan',
 *         usage: Promise.resolve({ inputTokens: 50, outputTokens: 25 }),
 *       }),
 *     ),
 *     stepCountIs: vi.fn((max: number) => max),
 *   };
 * });
 *
 * // Then in your test:
 * describe('My Test', () => {
 *   let mockIo: SocketIOServer<ClientToServerEvents, ServerToClientEvents>;
 *
 *   beforeEach(() => {
 *     mockIo = createMockIO();
 *   });
 *
 *   it('should work', async () => {
 *     // Use mockIo in your test
 *   });
 * });
 * ```
 */

import type { Server as SocketIOServer } from 'socket.io';
import { vi } from 'vitest';
import type { ClientToServerEvents, ServerToClientEvents } from '../../types/index.js';

/**
 * Create a mock Socket.IO server for testing
 *
 * Returns a minimal SocketIO server implementation that tracks emit calls.
 *
 * @example
 * ```typescript
 * const mockIo = createMockIO();
 * mockIo.to('session-123').emit('llm_message', message);
 * expect(mockIo.to).toHaveBeenCalledWith('session-123');
 * ```
 */
export function createMockIO(): SocketIOServer<ClientToServerEvents, ServerToClientEvents> {
  const mockEmit = vi.fn();
  return {
    to: vi.fn().mockReturnValue({ emit: mockEmit }),
    emit: mockEmit,
  } as unknown as SocketIOServer<ClientToServerEvents, ServerToClientEvents>;
}

/**
 * Create a mock streamText function for AI SDK
 *
 * Returns a function that simulates streaming LLM responses with:
 * - Text delta: "Test response"
 * - Usage: 100 input tokens, 50 output tokens
 * - Steps: Single step with "Done" text
 *
 * @example
 * ```typescript
 * const mockStream = createMockStreamText();
 * vi.mocked(streamText).mockImplementation(mockStream);
 * ```
 */
export function createMockStreamText() {
  return vi.fn(() => ({
    fullStream: (async function* () {
      yield { type: 'text-delta', text: 'Test response' };
      yield { type: 'finish' };
    })(),
    usage: Promise.resolve({ inputTokens: 100, outputTokens: 50 }),
    steps: Promise.resolve([{ toolCalls: [], text: 'Done' }]),
  }));
}

/**
 * Create a mock generateText function for AI SDK
 *
 * Returns a function that simulates non-streaming LLM responses with:
 * - Text: "Test plan"
 * - Usage: 50 input tokens, 25 output tokens
 *
 * Commonly used for planning phase tests.
 *
 * @example
 * ```typescript
 * const mockGenerate = createMockGenerateText();
 * vi.mocked(generateText).mockImplementation(mockGenerate);
 * ```
 */
export function createMockGenerateText() {
  return vi.fn(() =>
    Promise.resolve({
      text: 'Test plan',
      usage: Promise.resolve({ inputTokens: 50, outputTokens: 25 }),
    }),
  );
}

/**
 * Create a mock streamText with custom response
 *
 * Allows customizing the response text and token usage for specific test scenarios.
 *
 * @param text - Custom response text
 * @param inputTokens - Custom input token count
 * @param outputTokens - Custom output token count
 *
 * @example
 * ```typescript
 * const mockStream = createMockStreamTextWithResponse('Custom response', 200, 100);
 * vi.mocked(streamText).mockImplementation(mockStream);
 * ```
 */
export function createMockStreamTextWithResponse(
  text: string,
  inputTokens: number,
  outputTokens: number,
) {
  return vi.fn(() => ({
    fullStream: (async function* () {
      yield { type: 'text-delta', text };
      yield { type: 'finish' };
    })(),
    usage: Promise.resolve({ inputTokens, outputTokens }),
    steps: Promise.resolve([{ toolCalls: [], text }]),
  }));
}

/**
 * Create a mock generateText with custom response
 *
 * Allows customizing the response text and token usage for planning tests.
 *
 * @param text - Custom plan text
 * @param inputTokens - Custom input token count
 * @param outputTokens - Custom output token count
 *
 * @example
 * ```typescript
 * const mockGenerate = createMockGenerateTextWithResponse('Custom plan', 100, 50);
 * vi.mocked(generateText).mockImplementation(mockGenerate);
 * ```
 */
export function createMockGenerateTextWithResponse(
  text: string,
  inputTokens: number,
  outputTokens: number,
) {
  return vi.fn(() =>
    Promise.resolve({
      text,
      usage: Promise.resolve({ inputTokens, outputTokens }),
    }),
  );
}
