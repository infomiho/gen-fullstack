import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { Server as SocketIOServer } from 'socket.io';
import { ErrorFixingCapability } from '../error-fixing.capability.js';
import type { CapabilityContext } from '../../types/index.js';
import type { ValidationError } from '@gen-fullstack/shared';

// Mock the AI SDK
vi.mock('ai', () => ({
  streamText: vi.fn(),
  tool: vi.fn((config) => config),
  stepCountIs: vi.fn(),
}));

// Mock the LLM service
vi.mock('../../services/llm.service.js', () => ({
  getModel: vi.fn(() => ({})),
  calculateCost: vi.fn(() => 0.001),
}));

// Mock tools
vi.mock('../../tools/index.js', () => ({
  getToolsForCapability: vi.fn(() => ({
    readFile: {},
    writeFile: {},
    getFileTree: {},
    executeCommand: {},
  })),
}));

describe('ErrorFixingCapability', () => {
  let capability: ErrorFixingCapability;
  let mockIo: SocketIOServer;
  let mockContext: CapabilityContext;
  let mockValidationErrors: ValidationError[];

  beforeEach(() => {
    // Mock Socket.IO
    mockIo = {
      to: vi.fn(() => ({
        emit: vi.fn(),
      })),
      emit: vi.fn(),
    } as any;

    // Create capability instance
    capability = new ErrorFixingCapability('gpt-5-mini', mockIo);

    // Mock validation errors
    mockValidationErrors = [
      {
        type: 'prisma',
        file: 'prisma/schema.prisma',
        message: 'Invalid field type',
        line: 10,
      },
      {
        type: 'typescript',
        file: 'client/src/App.tsx',
        message: 'Cannot find name "foo"',
        line: 15,
        column: 5,
        code: 'TS2304',
      },
    ];

    // Mock context
    mockContext = {
      sessionId: 'test-session-123',
      prompt: 'Build a todo list app',
      sandboxPath: '/tmp/sandbox-123',
      tokens: { input: 0, output: 0, total: 0 },
      cost: 0,
      toolCalls: 0,
      startTime: Date.now(),
      validationErrors: mockValidationErrors,
      errorFixAttempts: 0,
      abortSignal: new AbortController().signal,
    };
  });

  describe('getName', () => {
    it('returns "ErrorFixing"', () => {
      expect(capability.getName()).toBe('ErrorFixing');
    });
  });

  describe('validateContext', () => {
    it('validates required fields', () => {
      expect(() => capability.validateContext(mockContext)).not.toThrow();
    });

    it('throws if sessionId is missing', () => {
      const invalidContext = { ...mockContext, sessionId: undefined as any };
      expect(() => capability.validateContext(invalidContext)).toThrow(
        'ErrorFixingCapability requires context.sessionId',
      );
    });

    it('throws if sandboxPath is missing', () => {
      const invalidContext = { ...mockContext, sandboxPath: undefined as any };
      expect(() => capability.validateContext(invalidContext)).toThrow(
        'ErrorFixingCapability requires context.sandboxPath',
      );
    });

    it('throws if validationErrors is missing', () => {
      const invalidContext = { ...mockContext, validationErrors: undefined };
      expect(() => capability.validateContext(invalidContext)).toThrow(
        'ErrorFixingCapability requires context.validationErrors',
      );
    });

    it('throws if validationErrors is empty', () => {
      const invalidContext = { ...mockContext, validationErrors: [] };
      expect(() => capability.validateContext(invalidContext)).toThrow(
        'ErrorFixingCapability requires context.validationErrors',
      );
    });
  });

  describe('execute', () => {
    it('successfully fixes errors and increments iteration count', async () => {
      // Mock streamText to simulate successful error fixing
      const { streamText } = await import('ai');
      const mockStreamText = streamText as Mock;

      mockStreamText.mockImplementation(({ onStepFinish }) => {
        (async () => {
          if (onStepFinish) {
            // Simulate reading a file
            await onStepFinish({
              toolCalls: [
                {
                  toolCallId: 'call-1',
                  toolName: 'readFile',
                  input: { path: 'client/src/App.tsx' },
                },
              ],
              toolResults: [
                {
                  toolCallId: 'call-1',
                  output: 'const foo = 123;',
                },
              ],
              finishReason: 'tool-calls',
            });

            // Simulate writing a fixed file
            await onStepFinish({
              toolCalls: [
                {
                  toolCallId: 'call-2',
                  toolName: 'writeFile',
                  input: { path: 'client/src/App.tsx', content: 'const bar = 123;' },
                },
              ],
              toolResults: [
                {
                  toolCallId: 'call-2',
                  output: 'File written successfully',
                },
              ],
              text: 'Fixed the TypeScript error by renaming variable.',
              finishReason: 'tool-calls',
            });
          }
        })();

        return {
          textStream: (async function* () {
            yield '';
          })(),
          usage: Promise.resolve({
            inputTokens: 500,
            outputTokens: 300,
          }),
        };
      });

      const result = await capability.execute(mockContext);

      expect(result.success).toBe(true);
      expect(result.contextUpdates?.errorFixAttempts).toBe(1); // Incremented from 0
      expect(result.tokensUsed?.input).toBe(500);
      expect(result.tokensUsed?.output).toBe(300);
      expect(result.toolCalls).toBe(2); // readFile + writeFile
    });

    it('handles multiple iterations correctly', async () => {
      const { streamText } = await import('ai');
      const mockStreamText = streamText as Mock;

      mockStreamText.mockImplementation(({ onStepFinish }) => {
        (async () => {
          if (onStepFinish) {
            await onStepFinish({
              toolCalls: [
                {
                  toolCallId: 'call-1',
                  toolName: 'writeFile',
                  input: { path: 'prisma/schema.prisma', content: 'fixed schema' },
                },
              ],
              toolResults: [
                {
                  toolCallId: 'call-1',
                  output: 'Success',
                },
              ],
              text: 'Fixed Prisma schema.',
              finishReason: 'tool-calls',
            });
          }
        })();

        return {
          textStream: (async function* () {
            yield '';
          })(),
          usage: Promise.resolve({
            inputTokens: 200,
            outputTokens: 100,
          }),
        };
      });

      // Second iteration
      const contextIteration2 = { ...mockContext, errorFixAttempts: 1 };
      const result = await capability.execute(contextIteration2);

      expect(result.success).toBe(true);
      expect(result.contextUpdates?.errorFixAttempts).toBe(2); // Incremented from 1 to 2
    });

    it('handles LLM errors gracefully', async () => {
      const { streamText } = await import('ai');
      const mockStreamText = streamText as Mock;

      // Mock error during stream consumption
      mockStreamText.mockImplementation(() => {
        const usagePromise = Promise.reject(new Error('LLM API error'));
        // Prevent unhandled rejection
        usagePromise.catch(() => {});

        return {
          textStream: (async function* () {
            yield ''; // Yield before throwing to satisfy generator requirements
            throw new Error('LLM API error');
          })(),
          usage: usagePromise,
        };
      });

      const result = await capability.execute(mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('LLM API error');
    });

    it('handles abort signal', async () => {
      const { streamText } = await import('ai');
      const mockStreamText = streamText as Mock;

      const abortController = new AbortController();
      const abortedContext = { ...mockContext, abortSignal: abortController.signal };

      mockStreamText.mockImplementation(() => {
        abortController.abort();
        const usagePromise = Promise.reject(new Error('Aborted'));
        // Prevent unhandled rejection
        usagePromise.catch(() => {});

        return {
          textStream: (async function* () {
            yield ''; // Yield before throwing to satisfy generator requirements
            throw new Error('Aborted');
          })(),
          usage: usagePromise,
        };
      });

      const result = await capability.execute(abortedContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Aborted');
    });

    it('groups errors by type in prompt', async () => {
      const { streamText } = await import('ai');
      const mockStreamText = streamText as Mock;

      let capturedMessages: any[] = [];

      mockStreamText.mockImplementation(async ({ messages }) => {
        capturedMessages = messages;
        return {
          usage: Promise.resolve({
            usage: {
              promptTokens: 100,
              completionTokens: 50,
            },
          }),
        };
      });

      await capability.execute(mockContext);

      // Check that user prompt includes both Prisma and TypeScript sections
      const userPrompt = capturedMessages.find((m) => m.role === 'user')?.content;
      expect(userPrompt).toContain('Prisma Schema Errors');
      expect(userPrompt).toContain('TypeScript Errors');
      expect(userPrompt).toContain('iteration 1');
    });
  });
});
