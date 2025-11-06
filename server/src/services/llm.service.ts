import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import type { LanguageModel } from 'ai';
import { MODEL_METADATA, type ModelId } from '@gen-fullstack/shared';
import { createLogger } from '../lib/logger.js';

const logger = createLogger({ service: 'llm-service' });

/**
 * Multi-Provider Model Configuration
 *
 * OpenAI GPT-5 Series:
 * - Released: August 2025
 * - Context: 272K input / 128K output tokens
 * - Capabilities: 74.9% SWE-bench Verified, 94.6% AIME 2025
 *
 * Anthropic Claude 4.5 Series:
 * - Released: October 2025
 * - Context: 200K tokens
 * - Capabilities: 73.3% SWE-bench Verified, fast inference
 *
 * Note: Model metadata (labels, descriptions, pricing) is now centralized
 * in @gen-fullstack/shared/model-metadata to maintain consistency between
 * client and server.
 */

/**
 * Type alias for model identifiers
 * Uses ModelId from shared package for consistency
 */
export type ModelName = ModelId;

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
 * // Use specific model
 * const premiumModel = getModel('gpt-5');
 * const claudeModel = getModel('claude-sonnet-4-5');
 * ```
 */
export function getModel(modelName: ModelName = 'gpt-5-mini'): LanguageModel {
  // GPT-5 models use the Responses API endpoint
  if (modelName.startsWith('gpt-5')) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        `Cannot use ${modelName}: OPENAI_API_KEY environment variable is not configured. ` +
          `Please add your OpenAI API key to the .env file.`,
      );
    }
    return openai.responses(modelName);
  }
  // Claude models use the Anthropic provider
  if (modelName.startsWith('claude-')) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        `Cannot use ${modelName}: ANTHROPIC_API_KEY environment variable is not configured. ` +
          `Please add your Anthropic API key to the .env file.`,
      );
    }
    return anthropic(modelName);
  }
  // Fallback to standard OpenAI Chat Completions API
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      `Cannot use ${modelName}: OPENAI_API_KEY environment variable is not configured. ` +
        `Please add your OpenAI API key to the .env file.`,
    );
  }
  return openai(modelName);
}

/**
 * Get pricing for a model (cost per token in USD)
 * Pricing data comes from MODEL_METADATA in shared package
 *
 * @param modelName - Model identifier
 * @returns Pricing object with input/output cost per token
 */
function getModelPricing(modelName: ModelName): { input: number; output: number } | null {
  const metadata = MODEL_METADATA[modelName];
  if (!metadata) return null;

  // Convert from "per 1M tokens" to "per token"
  return {
    input: metadata.pricing.input / 1_000_000,
    output: metadata.pricing.output / 1_000_000,
  };
}

/**
 * Calculate cost for a generation
 *
 * @param modelName - Model used (must be a known model with pricing data)
 * @param inputTokens - Number of input tokens
 * @param outputTokens - Number of output tokens
 * @returns Cost in USD
 *
 * @throws {Error} If pricing data is not available for the specified model
 *
 * @remarks
 * This function should never fail in normal operation because:
 * - All models are defined in MODEL_METADATA (single source of truth)
 * - Zod validation ensures only valid model IDs are accepted
 * - TypeScript types enforce model ID constraints
 *
 * If this error occurs, it indicates a serious configuration issue that
 * should be fixed immediately rather than silently using incorrect pricing.
 */
export function calculateCost(
  modelName: ModelName,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = getModelPricing(modelName);
  if (!pricing) {
    // Log error for debugging - this should never happen
    logger.error(
      { modelName, availableModels: Object.keys(MODEL_METADATA) },
      'CRITICAL: No pricing data for model - this indicates a configuration error',
    );

    // Always throw - fail fast rather than silently using incorrect pricing
    // This prevents financial discrepancies and makes bugs obvious
    throw new Error(
      `No pricing configured for model: ${modelName}. ` +
        `This should never happen - all models must be defined in MODEL_METADATA. ` +
        `Available models: ${Object.keys(MODEL_METADATA).join(', ')}`,
    );
  }

  return inputTokens * pricing.input + outputTokens * pricing.output;
}
