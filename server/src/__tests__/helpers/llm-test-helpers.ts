/**
 * Shared LLM Test Helpers
 *
 * Common mocks and utilities for testing multi-provider LLM functionality.
 * Used by both unit tests (llm.service.test.ts) and integration tests.
 */

import { vi } from 'vitest';

/**
 * Mock type for testing - includes provider property for test assertions
 */
export interface MockLanguageModel {
  provider: string;
  _type: string;
}

/**
 * Setup environment variables for testing
 * Mocks both OpenAI and Anthropic API keys
 */
export function setupTestAPIKeys() {
  process.env.OPENAI_API_KEY = 'test-openai-key';
  process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
}

/**
 * Setup mock providers for @ai-sdk/openai and @ai-sdk/anthropic
 * Must be called before importing the LLM service
 *
 * @example
 * ```typescript
 * setupLLMProviderMocks();
 * import { getModel } from '../services/llm.service';
 * ```
 */
export function setupLLMProviderMocks() {
  vi.mock('@ai-sdk/openai', () => {
    const mockOpenaiResponses = vi.fn(
      (): MockLanguageModel => ({
        provider: 'openai-responses',
        _type: 'LanguageModel',
      }),
    );
    const mockOpenai = vi.fn(
      (): MockLanguageModel => ({ provider: 'openai-chat', _type: 'LanguageModel' }),
    );
    return {
      openai: Object.assign(mockOpenai, {
        responses: mockOpenaiResponses,
      }),
    };
  });

  vi.mock('@ai-sdk/anthropic', () => ({
    anthropic: vi.fn((): MockLanguageModel => ({ provider: 'anthropic', _type: 'LanguageModel' })),
  }));
}

/**
 * Get mock function references after mocks are set up
 * Call this after importing the mocked modules
 */
export function getMockFunctions() {
  // Import after mocks are set up
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { openai } = require('@ai-sdk/openai');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { anthropic } = require('@ai-sdk/anthropic');

  const mockOpenaiResponses = (openai as unknown as { responses: ReturnType<typeof vi.fn> })
    .responses;
  const mockOpenai = openai as unknown as ReturnType<typeof vi.fn>;
  const mockAnthropic = anthropic as unknown as ReturnType<typeof vi.fn>;

  return {
    mockOpenaiResponses,
    mockOpenai,
    mockAnthropic,
  };
}
