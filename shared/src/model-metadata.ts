/**
 * Model Metadata - Single Source of Truth
 *
 * Centralized configuration for all supported AI models.
 * Used by both client (UI) and server (pricing, routing).
 *
 * Benefits:
 * - Single place to add/update models
 * - Consistent naming across client and server
 * - Type-safe model IDs
 * - Pricing and metadata co-located
 */

/**
 * Model configuration with metadata and pricing
 */
export interface ModelMetadata {
  /** Display name for UI */
  label: string;
  /** Provider name */
  provider: 'OpenAI' | 'Anthropic';
  /** Short description of model capabilities */
  description: string;
  /** Tier classification for grouping */
  tier: 'budget' | 'default' | 'premium' | 'fast' | 'balanced' | 'capable';
  /** Pricing per 1M tokens */
  pricing: {
    /** Input tokens cost per 1M tokens (USD) */
    input: number;
    /** Output tokens cost per 1M tokens (USD) */
    output: number;
  };
}

/**
 * Complete model catalog with metadata
 * Model ID is the key - consistent across all uses
 */
export const MODEL_METADATA = {
  // OpenAI GPT-5 Series (Responses API)
  'gpt-5': {
    label: 'GPT-5',
    provider: 'OpenAI' as const,
    description: 'Largest context window, highest capability model',
    tier: 'premium' as const,
    pricing: {
      input: 1.25, // $1.25 per 1M tokens
      output: 10, // $10 per 1M tokens
    },
  },
  'gpt-5-mini': {
    label: 'GPT-5 Mini',
    provider: 'OpenAI' as const,
    description: 'Recommended for most use cases',
    tier: 'default' as const,
    pricing: {
      input: 0.25, // $0.25 per 1M tokens
      output: 2, // $2 per 1M tokens
    },
  },
  'gpt-5-nano': {
    label: 'GPT-5 Nano',
    provider: 'OpenAI' as const,
    description: 'Smallest, fastest model with lower cost',
    tier: 'budget' as const,
    pricing: {
      input: 0.05, // $0.05 per 1M tokens
      output: 0.4, // $0.40 per 1M tokens
    },
  },

  // Anthropic Claude 4.5 / 4.1 Series (Chat Completions API)
  'claude-haiku-4-5': {
    label: 'Claude Haiku 4.5',
    provider: 'Anthropic' as const,
    description: 'Fast inference speed, lower latency',
    tier: 'fast' as const,
    pricing: {
      input: 1, // $1 per 1M tokens
      output: 5, // $5 per 1M tokens
    },
  },
  'claude-sonnet-4-5': {
    label: 'Claude Sonnet 4.5',
    provider: 'Anthropic' as const,
    description: 'Balanced performance and speed',
    tier: 'balanced' as const,
    pricing: {
      input: 3, // $3 per 1M tokens
      output: 15, // $15 per 1M tokens
    },
  },
  'claude-opus-4-1': {
    label: 'Claude Opus 4.1',
    provider: 'Anthropic' as const,
    description: 'Highest capability Anthropic model',
    tier: 'capable' as const,
    pricing: {
      input: 15, // $15 per 1M tokens
      output: 75, // $75 per 1M tokens
    },
  },
} as const;

/**
 * Type-safe model ID
 * Derived from MODEL_METADATA keys
 */
export type ModelId = keyof typeof MODEL_METADATA;

/**
 * Default model for new generations
 */
export const DEFAULT_MODEL: ModelId = 'gpt-5-mini';

/**
 * Get all model IDs as an array
 */
export const MODEL_IDS = Object.keys(MODEL_METADATA) as ModelId[];

/**
 * Get models grouped by provider
 */
export function getModelsByProvider() {
  const openai: ModelId[] = [];
  const anthropic: ModelId[] = [];

  for (const [id, metadata] of Object.entries(MODEL_METADATA)) {
    if (metadata.provider === 'OpenAI') {
      openai.push(id as ModelId);
    } else {
      anthropic.push(id as ModelId);
    }
  }

  return { openai, anthropic };
}

/**
 * Format pricing for display
 * @param modelId - Model identifier
 * @returns Formatted pricing string (e.g., "$0.25 / $2")
 */
export function formatPricing(modelId: ModelId): string {
  const { pricing } = MODEL_METADATA[modelId];
  const formatPrice = (price: number) =>
    price < 1 ? `$${price.toFixed(2)}` : `$${Math.round(price)}`;

  return `${formatPrice(pricing.input)} / ${formatPrice(pricing.output)}`;
}
