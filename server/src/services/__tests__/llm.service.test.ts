/**
 * LLM Service Tests - Multi-Provider Support
 *
 * Tests the LLM service's ability to work with multiple AI providers:
 * - OpenAI (GPT-5 series using Responses API)
 * - Anthropic (Claude series using standard Chat API)
 *
 * Coverage:
 * - Model instantiation and provider routing
 * - Multi-provider compatibility
 * - Cost calculations for all models
 * - Configuration validation
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MODEL_METADATA, DEFAULT_MODEL, type ModelId } from '@gen-fullstack/shared';
import {
  type MockLanguageModel,
  setupLLMProviderMocks,
  setupTestAPIKeys,
} from '../../__tests__/helpers/llm-test-helpers';
import { type ModelName, calculateCost, getModel } from '../llm.service';

// Setup mocks before importing mocked modules
setupLLMProviderMocks();

// Import mocked modules to get access to mock functions
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';

const mockOpenaiResponses = (openai as unknown as { responses: ReturnType<typeof vi.fn> })
  .responses;
const mockOpenai = openai as unknown as ReturnType<typeof vi.fn>;
const mockAnthropic = anthropic as unknown as ReturnType<typeof vi.fn>;

describe('LLM Service - Multi-Provider Support', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock environment variables so runtime API key checks pass
    setupTestAPIKeys();
  });

  describe('Model Instantiation', () => {
    it('should return OpenAI Responses API model for gpt-5 models', () => {
      const model = getModel('gpt-5');

      expect(mockOpenaiResponses).toHaveBeenCalledWith('gpt-5');
      expect(mockOpenai).not.toHaveBeenCalled();
      expect(mockAnthropic).not.toHaveBeenCalled();
      expect(model).toEqual({ provider: 'openai-responses', _type: 'LanguageModel' });
    });

    it('should return OpenAI Responses API model for gpt-5-mini', () => {
      const model = getModel('gpt-5-mini') as unknown as MockLanguageModel;

      expect(mockOpenaiResponses).toHaveBeenCalledWith('gpt-5-mini');
      expect(mockAnthropic).not.toHaveBeenCalled();
      expect(model.provider).toBe('openai-responses');
    });

    it('should return OpenAI Responses API model for gpt-5-nano', () => {
      const model = getModel('gpt-5-nano') as unknown as MockLanguageModel;

      expect(mockOpenaiResponses).toHaveBeenCalledWith('gpt-5-nano');
      expect(mockAnthropic).not.toHaveBeenCalled();
      expect(model.provider).toBe('openai-responses');
    });

    it('should return Anthropic model for claude-haiku-4-5', () => {
      const model = getModel('claude-haiku-4-5');

      expect(mockAnthropic).toHaveBeenCalledWith('claude-haiku-4-5');
      expect(mockOpenaiResponses).not.toHaveBeenCalled();
      expect(mockOpenai).not.toHaveBeenCalled();
      expect(model).toEqual({ provider: 'anthropic', _type: 'LanguageModel' });
    });

    it('should return Anthropic model for claude-sonnet-4-5', () => {
      const model = getModel('claude-sonnet-4-5') as unknown as MockLanguageModel;

      expect(mockAnthropic).toHaveBeenCalledWith('claude-sonnet-4-5');
      expect(mockOpenaiResponses).not.toHaveBeenCalled();
      expect(model.provider).toBe('anthropic');
    });

    it('should return Anthropic model for claude-opus-4-1', () => {
      const model = getModel('claude-opus-4-1') as unknown as MockLanguageModel;

      expect(mockAnthropic).toHaveBeenCalledWith('claude-opus-4-1');
      expect(mockOpenaiResponses).not.toHaveBeenCalled();
      expect(model.provider).toBe('anthropic');
    });

    it('should use default model (gpt-5-mini) when none specified', () => {
      const model = getModel() as unknown as MockLanguageModel;

      expect(mockOpenaiResponses).toHaveBeenCalledWith('gpt-5-mini');
      expect(model.provider).toBe('openai-responses');
    });

    it('should return standard OpenAI chat for non-gpt-5/claude models', () => {
      // This tests the fallback case for future compatibility
      const model = getModel('gpt-4o' as ModelName) as unknown as MockLanguageModel;

      expect(mockOpenai).toHaveBeenCalledWith('gpt-4o');
      expect(mockOpenaiResponses).not.toHaveBeenCalled();
      expect(mockAnthropic).not.toHaveBeenCalled();
      expect(model.provider).toBe('openai-chat');
    });
  });

  describe('Multi-Provider Compatibility', () => {
    it('should instantiate both OpenAI and Anthropic models in same test', () => {
      const gptModel = getModel('gpt-5-mini') as unknown as MockLanguageModel;
      const claudeModel = getModel('claude-haiku-4-5') as unknown as MockLanguageModel;

      expect(mockOpenaiResponses).toHaveBeenCalledWith('gpt-5-mini');
      expect(mockAnthropic).toHaveBeenCalledWith('claude-haiku-4-5');
      expect(gptModel.provider).toBe('openai-responses');
      expect(claudeModel.provider).toBe('anthropic');
    });

    it('should return LanguageModel interface for both providers', () => {
      const gptModel = getModel('gpt-5-mini') as unknown as MockLanguageModel;
      const claudeModel = getModel('claude-haiku-4-5') as unknown as MockLanguageModel;

      // Both should be defined and have the marker _type
      expect(gptModel).toBeDefined();
      expect(gptModel._type).toBe('LanguageModel');
      expect(claudeModel).toBeDefined();
      expect(claudeModel._type).toBe('LanguageModel');
    });

    it('should not have provider conflicts when switching models', () => {
      const model1 = getModel('gpt-5') as unknown as MockLanguageModel;
      const model2 = getModel('claude-sonnet-4-5') as unknown as MockLanguageModel;
      const model3 = getModel('gpt-5-nano') as unknown as MockLanguageModel;
      const model4 = getModel('claude-haiku-4-5') as unknown as MockLanguageModel;

      expect(mockOpenaiResponses).toHaveBeenCalledTimes(2);
      expect(mockAnthropic).toHaveBeenCalledTimes(2);
      expect(model1.provider).toBe('openai-responses');
      expect(model2.provider).toBe('anthropic');
      expect(model3.provider).toBe('openai-responses');
      expect(model4.provider).toBe('anthropic');
    });
  });

  describe('API Routing', () => {
    it('should route gpt-5 prefix to openai.responses()', () => {
      getModel('gpt-5');
      getModel('gpt-5-mini');
      getModel('gpt-5-nano');

      expect(mockOpenaiResponses).toHaveBeenCalledTimes(3);
      expect(mockOpenai).not.toHaveBeenCalled();
    });

    it('should route claude- prefix to anthropic()', () => {
      getModel('claude-haiku-4-5');
      getModel('claude-sonnet-4-5');
      getModel('claude-opus-4-1');

      expect(mockAnthropic).toHaveBeenCalledTimes(3);
      expect(mockOpenaiResponses).not.toHaveBeenCalled();
    });

    it('should route unknown models to openai() fallback', () => {
      getModel('gpt-4' as ModelName);

      expect(mockOpenai).toHaveBeenCalledWith('gpt-4');
      expect(mockOpenaiResponses).not.toHaveBeenCalled();
      expect(mockAnthropic).not.toHaveBeenCalled();
    });
  });

  describe('Pricing Calculations', () => {
    it('should calculate cost for GPT-5-mini correctly', () => {
      // Input: $0.25/1M, Output: $2/1M
      const cost = calculateCost('gpt-5-mini', 1000, 1000);
      const expectedCost = (1000 * 0.25) / 1_000_000 + (1000 * 2) / 1_000_000;

      expect(cost).toBeCloseTo(expectedCost, 8);
      expect(cost).toBeCloseTo(0.00225, 8); // $0.00225 for 1k in + 1k out
    });

    it('should calculate cost for GPT-5 correctly', () => {
      // Input: $1.25/1M, Output: $10/1M
      const cost = calculateCost('gpt-5', 1000, 1000);
      const expectedCost = (1000 * 1.25) / 1_000_000 + (1000 * 10) / 1_000_000;

      expect(cost).toBeCloseTo(expectedCost, 8);
      expect(cost).toBeCloseTo(0.01125, 8);
    });

    it('should calculate cost for GPT-5-nano correctly', () => {
      // Input: $0.05/1M, Output: $0.40/1M
      const cost = calculateCost('gpt-5-nano', 1000, 1000);
      const expectedCost = (1000 * 0.05) / 1_000_000 + (1000 * 0.4) / 1_000_000;

      expect(cost).toBeCloseTo(expectedCost, 8);
      expect(cost).toBeCloseTo(0.00045, 8);
    });

    it('should calculate cost for Claude Haiku 4.5 correctly', () => {
      // Input: $1/1M, Output: $5/1M
      const cost = calculateCost('claude-haiku-4-5', 1000, 1000);
      const expectedCost = (1000 * 1) / 1_000_000 + (1000 * 5) / 1_000_000;

      expect(cost).toBeCloseTo(expectedCost, 8);
      expect(cost).toBeCloseTo(0.006, 8); // $0.006 for 1k in + 1k out
    });

    it('should calculate cost for Claude Sonnet 4.5 correctly', () => {
      // Input: $3/1M, Output: $15/1M
      const cost = calculateCost('claude-sonnet-4-5', 1000, 1000);
      const expectedCost = (1000 * 3) / 1_000_000 + (1000 * 15) / 1_000_000;

      expect(cost).toBeCloseTo(expectedCost, 8);
      expect(cost).toBeCloseTo(0.018, 8);
    });

    it('should calculate cost for Claude Opus 4.1 correctly', () => {
      // Input: $15/1M, Output: $75/1M
      const cost = calculateCost('claude-opus-4-1', 1000, 1000);
      const expectedCost = (1000 * 15) / 1_000_000 + (1000 * 75) / 1_000_000;

      expect(cost).toBeCloseTo(expectedCost, 8);
      expect(cost).toBeCloseTo(0.09, 8);
    });

    it('should verify Claude Haiku is more expensive than GPT-5-mini per token', () => {
      const gptCost = calculateCost('gpt-5-mini', 1000, 1000);
      const claudeCost = calculateCost('claude-haiku-4-5', 1000, 1000);

      // Claude Haiku: $6/1M total, GPT-5-mini: $2.25/1M total
      expect(claudeCost).toBeGreaterThan(gptCost);
      expect(claudeCost).toBeCloseTo(0.006, 8);
      expect(gptCost).toBeCloseTo(0.00225, 8);
    });

    it('should verify GPT-5-nano is cheapest model', () => {
      const nanoCost = calculateCost('gpt-5-nano', 1000, 1000);
      const miniCost = calculateCost('gpt-5-mini', 1000, 1000);
      const haikuCost = calculateCost('claude-haiku-4-5', 1000, 1000);

      expect(nanoCost).toBeLessThan(miniCost);
      expect(nanoCost).toBeLessThan(haikuCost);
    });

    it('should throw error for unknown model instead of fallback', () => {
      // After review, we chose to always throw (fail fast) rather than silently
      // use incorrect pricing, which could lead to financial discrepancies
      expect(() => {
        calculateCost('unknown-model' as ModelName, 1000, 1000);
      }).toThrow(/No pricing configured for model: unknown-model/);

      expect(() => {
        calculateCost('unknown-model' as ModelName, 1000, 1000);
      }).toThrow(/all models must be defined in MODEL_METADATA/);
    });

    it('should handle large token counts', () => {
      // 100K input, 50K output tokens
      const cost = calculateCost('claude-haiku-4-5', 100_000, 50_000);
      const expectedCost = (100_000 * 1) / 1_000_000 + (50_000 * 5) / 1_000_000;

      expect(cost).toBeCloseTo(expectedCost, 8);
      expect(cost).toBeCloseTo(0.35, 8); // $0.35
    });

    it('should handle zero tokens', () => {
      const cost = calculateCost('gpt-5-mini', 0, 0);
      expect(cost).toBe(0);
    });
  });

  describe('API Key Validation', () => {
    it('should throw error when OPENAI_API_KEY is missing for GPT models', () => {
      delete process.env.OPENAI_API_KEY;

      expect(() => getModel('gpt-5-mini')).toThrow(
        'Cannot use gpt-5-mini: OPENAI_API_KEY environment variable is not configured',
      );
      expect(() => getModel('gpt-5')).toThrow('OPENAI_API_KEY');
      expect(() => getModel('gpt-5-nano')).toThrow('OPENAI_API_KEY');

      // Restore for other tests
      process.env.OPENAI_API_KEY = 'test-openai-key';
    });

    it('should throw error when ANTHROPIC_API_KEY is missing for Claude models', () => {
      delete process.env.ANTHROPIC_API_KEY;

      expect(() => getModel('claude-haiku-4-5')).toThrow(
        'Cannot use claude-haiku-4-5: ANTHROPIC_API_KEY environment variable is not configured',
      );
      expect(() => getModel('claude-sonnet-4-5')).toThrow('ANTHROPIC_API_KEY');
      expect(() => getModel('claude-opus-4-1')).toThrow('ANTHROPIC_API_KEY');

      // Restore for other tests
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    });

    it('should work with only OpenAI key configured', () => {
      delete process.env.ANTHROPIC_API_KEY;

      // OpenAI models should work
      expect(() => getModel('gpt-5-mini')).not.toThrow();
      expect(() => getModel('gpt-5')).not.toThrow();

      // Claude models should throw
      expect(() => getModel('claude-haiku-4-5')).toThrow('ANTHROPIC_API_KEY');

      // Restore
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    });

    it('should work with only Anthropic key configured', () => {
      delete process.env.OPENAI_API_KEY;

      // Claude models should work
      expect(() => getModel('claude-haiku-4-5')).not.toThrow();
      expect(() => getModel('claude-sonnet-4-5')).not.toThrow();

      // GPT models should throw
      expect(() => getModel('gpt-5-mini')).toThrow('OPENAI_API_KEY');

      // Restore
      process.env.OPENAI_API_KEY = 'test-openai-key';
    });

    it('should include helpful error message with path to .env file', () => {
      delete process.env.OPENAI_API_KEY;

      try {
        getModel('gpt-5');
      } catch (error) {
        expect((error as Error).message).toContain(
          'Please add your OpenAI API key to the .env file',
        );
      }

      // Restore
      process.env.OPENAI_API_KEY = 'test-openai-key';
    });
  });

  describe('Model Configuration', () => {
    it('should have all expected OpenAI models in metadata', () => {
      expect(MODEL_METADATA['gpt-5']).toBeDefined();
      expect(MODEL_METADATA['gpt-5'].provider).toBe('OpenAI');
      expect(MODEL_METADATA['gpt-5-mini']).toBeDefined();
      expect(MODEL_METADATA['gpt-5-nano']).toBeDefined();
    });

    it('should have all expected Claude models in metadata', () => {
      expect(MODEL_METADATA['claude-haiku-4-5']).toBeDefined();
      expect(MODEL_METADATA['claude-haiku-4-5'].provider).toBe('Anthropic');
      expect(MODEL_METADATA['claude-sonnet-4-5']).toBeDefined();
      expect(MODEL_METADATA['claude-opus-4-1']).toBeDefined();
    });

    it('should have pricing for all models', () => {
      const modelIds: ModelId[] = [
        'gpt-5',
        'gpt-5-mini',
        'gpt-5-nano',
        'claude-haiku-4-5',
        'claude-sonnet-4-5',
        'claude-opus-4-1',
      ];

      for (const id of modelIds) {
        expect(MODEL_METADATA[id]).toBeDefined();
        expect(MODEL_METADATA[id].pricing.input).toBeGreaterThan(0);
        expect(MODEL_METADATA[id].pricing.output).toBeGreaterThan(0);
      }
    });

    it('should have input and output pricing for each model', () => {
      for (const [_, metadata] of Object.entries(MODEL_METADATA)) {
        expect(metadata.pricing.input).toBeGreaterThan(0);
        expect(metadata.pricing.output).toBeGreaterThan(0);
        expect(metadata.pricing.output).toBeGreaterThanOrEqual(metadata.pricing.input);
      }
    });

    it('should have correct number of models configured', () => {
      const modelIds = Object.keys(MODEL_METADATA);
      // 3 OpenAI + 3 Claude = 6 models
      expect(modelIds).toHaveLength(6);
    });

    it('should have default model set to gpt-5-mini', () => {
      expect(DEFAULT_MODEL).toBe('gpt-5-mini');
    });
  });
});
