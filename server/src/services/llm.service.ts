import { openai } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';

/**
 * GPT-5 Model Configuration
 *
 * Released: August 2025
 * Models available: gpt-5, gpt-5-mini, gpt-5-nano
 *
 * Context: 272K input / 128K output tokens
 * Capabilities: 74.9% SWE-bench Verified, 94.6% AIME 2025
 */
export const MODEL_CONFIG = {
  /** Default model for most use cases - best balance of cost/performance */
  default: 'gpt-5-mini', // $0.25/$2 per 1M tokens, excellent performance

  /** Premium model for complex scenarios */
  premium: 'gpt-5', // $1.25/$10 per 1M tokens, 74.9% SWE-bench Verified

  /** Budget model for simple, rapid demos */
  budget: 'gpt-5-nano', // $0.05/$0.40 per 1M tokens, ultra-fast
} as const;

export type ModelName = (typeof MODEL_CONFIG)[keyof typeof MODEL_CONFIG];

/**
 * Get a configured language model
 *
 * @param modelName - Model identifier (default: 'gpt-5-mini')
 * @returns Configured language model instance
 *
 * @example
 * ```typescript
 * // Use default model (gpt-5-mini)
 * const model = getModel();
 *
 * // Use premium model
 * const premiumModel = getModel('gpt-5');
 *
 * // Use from config
 * const budgetModel = getModel(MODEL_CONFIG.budget);
 * ```
 */
export function getModel(modelName: ModelName = MODEL_CONFIG.default): LanguageModel {
  // GPT-5 models use the Responses API endpoint
  if (modelName.startsWith('gpt-5')) {
    return openai.responses(modelName);
  }
  // Other models use the standard Chat Completions API
  return openai(modelName);
}

/**
 * Model pricing information for cost estimation
 */
export const MODEL_PRICING = {
  'gpt-5': {
    input: 1.25 / 1_000_000, // $1.25 per 1M tokens
    output: 10 / 1_000_000, // $10 per 1M tokens
  },
  'gpt-5-mini': {
    input: 0.25 / 1_000_000, // $0.25 per 1M tokens
    output: 2 / 1_000_000, // $2 per 1M tokens
  },
  'gpt-5-nano': {
    input: 0.05 / 1_000_000, // $0.05 per 1M tokens
    output: 0.4 / 1_000_000, // $0.40 per 1M tokens
  },
} as const;

/**
 * Calculate cost for a generation
 *
 * @param modelName - Model used
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @returns Cost in USD
 */
export function calculateCost(
  modelName: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = MODEL_PRICING[modelName as keyof typeof MODEL_PRICING];
  if (!pricing) {
    // Default to gpt-5-mini pricing if unknown model
    return calculateCost(MODEL_CONFIG.default, inputTokens, outputTokens);
  }

  return inputTokens * pricing.input + outputTokens * pricing.output;
}
