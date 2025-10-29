import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { Server as SocketIOServer } from 'socket.io';
import { PlanningCapability } from '../planning.capability.js';
import type { CapabilityContext } from '../../types/index.js';

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

describe('PlanningCapability', () => {
  let capability: PlanningCapability;
  let mockIo: SocketIOServer;
  let mockContext: CapabilityContext;

  beforeEach(() => {
    // Mock Socket.IO
    mockIo = {
      to: vi.fn(() => ({
        emit: vi.fn(),
      })),
      emit: vi.fn(),
    } as any;

    // Create capability instance
    capability = new PlanningCapability('gpt-5-mini', mockIo);

    // Mock context
    mockContext = {
      sessionId: 'test-session-123',
      prompt: 'Build a todo list app',
      sandboxPath: '/tmp/sandbox-123',
      tokens: { input: 0, output: 0, total: 0 },
      cost: 0,
      toolCalls: 0,
      startTime: Date.now(),
      abortSignal: new AbortController().signal,
    };
  });

  describe('getName', () => {
    it('returns "Planning"', () => {
      expect(capability.getName()).toBe('Planning');
    });
  });

  describe('validateContext', () => {
    it('validates required fields', () => {
      expect(() => capability.validateContext(mockContext)).not.toThrow();
    });

    it('throws if sessionId is missing', () => {
      const invalidContext = { ...mockContext, sessionId: undefined as any };
      expect(() => capability.validateContext(invalidContext)).toThrow(
        'PlanningCapability requires context.sessionId',
      );
    });

    it('throws if prompt is missing', () => {
      const invalidContext = { ...mockContext, prompt: undefined as any };
      expect(() => capability.validateContext(invalidContext)).toThrow(
        'PlanningCapability requires context.prompt',
      );
    });
  });

  describe('execute', () => {
    it('returns structured plan when successful', async () => {
      // Mock streamText to simulate successful planning
      const { streamText } = await import('ai');
      const mockStreamText = streamText as Mock;

      const mockPlan = {
        databaseModels: [
          {
            name: 'Todo',
            fields: ['id String @id', 'title String', 'completed Boolean @default(false)'],
          },
        ],
        apiRoutes: [
          { method: 'GET' as const, path: '/api/todos', description: 'Get all todos' },
          { method: 'POST' as const, path: '/api/todos', description: 'Create a todo' },
        ],
        clientComponents: [
          { name: 'TodoList', purpose: 'Display list of todos' },
          { name: 'TodoForm', purpose: 'Form to create new todos' },
        ],
      };

      mockStreamText.mockImplementation(({ onStepFinish }) => {
        // Call onStepFinish asynchronously
        (async () => {
          if (onStepFinish) {
            await onStepFinish({
              toolCalls: [
                {
                  toolCallId: 'call-123',
                  toolName: 'planArchitecture',
                  input: mockPlan,
                },
              ],
              toolResults: [
                {
                  toolCallId: 'call-123',
                  output: mockPlan,
                },
              ],
              text: 'Created a plan with 1 database model, 2 API routes, and 2 components.',
              finishReason: 'tool-calls',
            });
          }
        })();

        // Return synchronously (AI SDK 5.0 behavior)
        return {
          textStream: (async function* () {
            yield '';
          })(),
          usage: Promise.resolve({
            inputTokens: 100,
            outputTokens: 200,
          }),
        };
      });

      const result = await capability.execute(mockContext);

      expect(result.success).toBe(true);
      expect(result.contextUpdates?.plan).toEqual(mockPlan);
      expect(result.tokensUsed?.input).toBe(100);
      expect(result.tokensUsed?.output).toBe(200);
      expect(result.toolCalls).toBe(0); // Tool calls not emitted (pipeline stage provides visibility)
    });

    it('fails if LLM does not call planArchitecture tool', async () => {
      // Mock streamText to simulate no tool call
      const { streamText } = await import('ai');
      const mockStreamText = streamText as Mock;

      mockStreamText.mockImplementation(({ onStepFinish }) => {
        (async () => {
          if (onStepFinish) {
            await onStepFinish({
              toolCalls: [], // No tool calls
              text: 'I will not create a plan.',
              finishReason: 'stop',
            });
          }
        })();

        return {
          textStream: (async function* () {
            yield '';
          })(),
          usage: Promise.resolve({
            inputTokens: 50,
            outputTokens: 50,
          }),
        };
      });

      const result = await capability.execute(mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain(
        'LLM did not create a plan (planArchitecture tool was not called)',
      );
    });

    it('fails if plan is empty', async () => {
      // Mock streamText to simulate empty plan
      const { streamText } = await import('ai');
      const mockStreamText = streamText as Mock;

      const emptyPlan = {
        databaseModels: [],
        apiRoutes: [],
        clientComponents: [],
      };

      mockStreamText.mockImplementation(({ onStepFinish }) => {
        (async () => {
          if (onStepFinish) {
            await onStepFinish({
              toolCalls: [
                {
                  toolCallId: 'call-123',
                  toolName: 'planArchitecture',
                  input: emptyPlan,
                },
              ],
              toolResults: [
                {
                  toolCallId: 'call-123',
                  output: emptyPlan,
                },
              ],
              text: 'Plan created.',
              finishReason: 'tool-calls',
            });
          }
        })();

        return {
          textStream: (async function* () {
            yield '';
          })(),
          usage: Promise.resolve({
            inputTokens: 50,
            outputTokens: 50,
          }),
        };
      });

      const result = await capability.execute(mockContext);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Plan is empty');
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
  });
});
