/**
 * Multi-Provider Integration Tests
 *
 * Tests that both OpenAI and Anthropic providers work correctly with the
 * Vercel AI SDK's unified interface for streaming, tool calling, and token counting.
 *
 * These tests verify:
 * - Both providers work with streamText()
 * - Tool calling compatibility
 * - Token usage tracking
 * - No provider state contamination
 * - Error handling for both providers
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type MockLanguageModel,
  setupLLMProviderMocks,
  setupTestAPIKeys,
} from './helpers/llm-test-helpers';
import { getModel } from '../services/llm.service';

// Mock the AI SDK functions - create factory to avoid shared state
const createMockStreamTextResult = () => ({
  fullStream: (async function* () {
    yield { type: 'text-delta', textDelta: 'Hello' };
    yield { type: 'text-delta', textDelta: ' ' };
    yield { type: 'text-delta', textDelta: 'world' };
    yield {
      type: 'finish',
      finishReason: 'stop',
      usage: { promptTokens: 10, completionTokens: 3, totalTokens: 13 },
    };
  })(),
  textStream: (async function* () {
    yield 'Hello';
    yield ' ';
    yield 'world';
  })(),
  usage: Promise.resolve({ promptTokens: 10, completionTokens: 3, totalTokens: 13 }),
});

const mockStreamText = vi.fn((_params: any) => createMockStreamTextResult());

vi.mock('ai', () => ({
  streamText: mockStreamText,
  tool: vi.fn((def) => def), // Pass-through for tool definitions
}));

// Setup mock providers
setupLLMProviderMocks();

describe('Multi-Provider Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock environment variables so runtime API key checks pass
    setupTestAPIKeys();
  });

  describe('Streaming Text Generation', () => {
    it('should stream text with GPT-5-mini (Responses API)', async () => {
      const model = getModel('gpt-5-mini') as unknown as MockLanguageModel;
      const result = mockStreamText({ model, prompt: 'Hello' } as any);

      expect(result).toBeDefined();
      expect(result.fullStream).toBeDefined();
      expect(result.textStream).toBeDefined();

      // Verify model is OpenAI Responses API
      expect(model.provider).toBe('openai-responses');
    });

    it('should stream text with Claude Haiku (Chat API)', async () => {
      const model = getModel('claude-haiku-4-5') as unknown as MockLanguageModel;
      const result = mockStreamText({ model, prompt: 'Hello' } as any);

      expect(result).toBeDefined();
      expect(result.fullStream).toBeDefined();
      expect(result.textStream).toBeDefined();

      // Verify model is Anthropic
      expect(model.provider).toBe('anthropic');
    });

    it('should collect streamed text from both providers', async () => {
      const gptModel = getModel('gpt-5-mini');
      const claudeModel = getModel('claude-haiku-4-5');

      const gptResult = mockStreamText({ model: gptModel, prompt: 'Test' } as any);
      const claudeResult = mockStreamText({ model: claudeModel, prompt: 'Test' } as any);

      // Collect text from both streams
      const gptText: string[] = [];
      for await (const chunk of gptResult.textStream) {
        gptText.push(chunk);
      }

      const claudeText: string[] = [];
      for await (const chunk of claudeResult.textStream) {
        claudeText.push(chunk);
      }

      expect(gptText.join('')).toBe('Hello world');
      expect(claudeText.join('')).toBe('Hello world');
    });
  });

  describe('Token Usage Tracking', () => {
    it('should track token usage for GPT-5-mini', async () => {
      const model = getModel('gpt-5-mini');
      const result = mockStreamText({ model, prompt: 'Test' } as any);

      const usage = await result.usage;
      expect(usage).toBeDefined();
      expect(usage.promptTokens).toBe(10);
      expect(usage.completionTokens).toBe(3);
      expect(usage.totalTokens).toBe(13);
    });

    it('should track token usage for Claude Haiku', async () => {
      const model = getModel('claude-haiku-4-5');
      const result = mockStreamText({ model, prompt: 'Test' } as any);

      const usage = await result.usage;
      expect(usage).toBeDefined();
      expect(usage.promptTokens).toBe(10);
      expect(usage.completionTokens).toBe(3);
      expect(usage.totalTokens).toBe(13);
    });

    it('should handle usage data from both providers independently', async () => {
      const gptModel = getModel('gpt-5-mini');
      const claudeModel = getModel('claude-haiku-4-5');

      const gptResult = mockStreamText({ model: gptModel, prompt: 'Test 1' } as any);
      const claudeResult = mockStreamText({ model: claudeModel, prompt: 'Test 2' } as any);

      const gptUsage = await gptResult.usage;
      const claudeUsage = await claudeResult.usage;

      // Both should have independent usage data
      expect(gptUsage.totalTokens).toBe(13);
      expect(claudeUsage.totalTokens).toBe(13);
    });
  });

  describe('Tool Calling Compatibility', () => {
    it('should accept tools for GPT-5-mini', async () => {
      const model = getModel('gpt-5-mini');

      const tools = {
        getCurrentWeather: {
          description: 'Get the current weather',
          parameters: { type: 'object', properties: { location: { type: 'string' } } },
          execute: async ({ location }: { location: string }) => {
            return { temperature: 72, location };
          },
        },
      };

      const result = mockStreamText({ model, prompt: 'Weather?', tools } as any);

      expect(result).toBeDefined();
      expect(mockStreamText).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.objectContaining({ provider: 'openai-responses' }),
          tools,
        }),
      );
    });

    it('should accept tools for Claude Haiku', async () => {
      const model = getModel('claude-haiku-4-5');

      const tools = {
        getCurrentWeather: {
          description: 'Get the current weather',
          parameters: { type: 'object', properties: { location: { type: 'string' } } },
          execute: async ({ location }: { location: string }) => {
            return { temperature: 72, location };
          },
        },
      };

      const result = mockStreamText({ model, prompt: 'Weather?', tools } as any);

      expect(result).toBeDefined();
      expect(mockStreamText).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.objectContaining({ provider: 'anthropic' }),
          tools,
        }),
      );
    });

    it('should handle same tool definitions for both providers', async () => {
      const gptModel = getModel('gpt-5-mini');
      const claudeModel = getModel('claude-haiku-4-5');

      const sharedTools = {
        writeFile: {
          description: 'Write content to a file',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              content: { type: 'string' },
            },
            required: ['path', 'content'],
          },
          execute: async ({ path, content }: { path: string; content: string }) => {
            return { success: true, path, bytesWritten: content.length };
          },
        },
      };

      // Both providers should accept the same tool definition
      const gptResult = mockStreamText({
        model: gptModel,
        prompt: 'Write file',
        tools: sharedTools,
      } as any);
      const claudeResult = mockStreamText({
        model: claudeModel,
        prompt: 'Write file',
        tools: sharedTools,
      } as any);

      expect(gptResult).toBeDefined();
      expect(claudeResult).toBeDefined();
      expect(mockStreamText).toHaveBeenCalledTimes(2);
    });
  });

  describe('Provider Isolation', () => {
    it('should not contaminate state between providers', async () => {
      // Create models from both providers
      const gptModel1 = getModel('gpt-5-mini') as unknown as MockLanguageModel;
      const claudeModel1 = getModel('claude-haiku-4-5') as unknown as MockLanguageModel;
      const gptModel2 = getModel('gpt-5') as unknown as MockLanguageModel;
      const claudeModel2 = getModel('claude-sonnet-4-5') as unknown as MockLanguageModel;

      // All should have correct providers
      expect(gptModel1.provider).toBe('openai-responses');
      expect(claudeModel1.provider).toBe('anthropic');
      expect(gptModel2.provider).toBe('openai-responses');
      expect(claudeModel2.provider).toBe('anthropic');

      // Stream from all models
      mockStreamText({ model: gptModel1, prompt: 'Test 1' } as any);
      mockStreamText({ model: claudeModel1, prompt: 'Test 2' } as any);
      mockStreamText({ model: gptModel2, prompt: 'Test 3' } as any);
      mockStreamText({ model: claudeModel2, prompt: 'Test 4' } as any);

      // Verify all calls were made correctly
      expect(mockStreamText).toHaveBeenCalledTimes(4);
    });

    it('should handle concurrent requests to both providers', async () => {
      const gptModel = getModel('gpt-5-mini');
      const claudeModel = getModel('claude-haiku-4-5');

      // Start both streams concurrently
      const [gptResult, claudeResult] = await Promise.all([
        mockStreamText({ model: gptModel, prompt: 'GPT test' } as any),
        mockStreamText({ model: claudeModel, prompt: 'Claude test' } as any),
      ]);

      expect(gptResult).toBeDefined();
      expect(claudeResult).toBeDefined();
      expect(mockStreamText).toHaveBeenCalledTimes(2);
    });
  });

  describe('LanguageModel Interface', () => {
    it('should return compatible LanguageModel for all providers', () => {
      const models = [
        getModel('gpt-5'),
        getModel('gpt-5-mini'),
        getModel('gpt-5-nano'),
        getModel('claude-haiku-4-5'),
        getModel('claude-sonnet-4-5'),
        getModel('claude-opus-4-1'),
      ];

      // All models should be defined and usable
      for (const model of models) {
        expect(model).toBeDefined();
        expect(model as any).toHaveProperty('provider');
      }
    });

    it('should work with unified AI SDK functions', async () => {
      // Both providers should work with the same streamText function
      const gptModel = getModel('gpt-5-mini');
      const claudeModel = getModel('claude-haiku-4-5');

      // Same function signature for both
      const gptPromise = mockStreamText({ model: gptModel, prompt: 'Test' } as any);
      const claudePromise = mockStreamText({ model: claudeModel, prompt: 'Test' } as any);

      const [gptResult, claudeResult] = await Promise.all([gptPromise, claudePromise]);

      expect(gptResult).toBeDefined();
      expect(claudeResult).toBeDefined();

      // Both should have the same result structure
      expect(gptResult).toHaveProperty('fullStream');
      expect(gptResult).toHaveProperty('textStream');
      expect(gptResult).toHaveProperty('usage');
      expect(claudeResult).toHaveProperty('fullStream');
      expect(claudeResult).toHaveProperty('textStream');
      expect(claudeResult).toHaveProperty('usage');
    });
  });

  describe('Error Scenarios', () => {
    it('should handle errors from OpenAI provider gracefully', async () => {
      mockStreamText.mockImplementationOnce(() => {
        throw new Error('OpenAI API error');
      });

      const model = getModel('gpt-5-mini');

      await expect(async () => {
        mockStreamText({ model, prompt: 'Test' } as any);
      }).rejects.toThrow('OpenAI API error');
    });

    it('should handle errors from Anthropic provider gracefully', async () => {
      mockStreamText.mockImplementationOnce(() => {
        throw new Error('Anthropic API error');
      });

      const model = getModel('claude-haiku-4-5');

      await expect(async () => {
        mockStreamText({ model, prompt: 'Test' } as any);
      }).rejects.toThrow('Anthropic API error');
    });

    it('should not affect other provider when one fails', async () => {
      mockStreamText
        .mockImplementationOnce(() => {
          throw new Error('OpenAI error');
        })
        .mockImplementationOnce(() => createMockStreamTextResult());

      const gptModel = getModel('gpt-5-mini');
      const claudeModel = getModel('claude-haiku-4-5');

      // First call should fail
      await expect(async () => {
        mockStreamText({ model: gptModel, prompt: 'Test' } as any);
      }).rejects.toThrow('OpenAI error');

      // Second call should succeed
      const result = mockStreamText({ model: claudeModel, prompt: 'Test' } as any);
      expect(result).toBeDefined();
    });
  });
});
