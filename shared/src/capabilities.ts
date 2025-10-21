import { z } from 'zod';

/**
 * Capability system for composable app generation
 *
 * This module defines a flexible capability-based architecture with three
 * independent dimensions:
 * 1. Input Mode: naive vs template (mutually exclusive)
 * 2. Planning: enabled/disabled (can be combined with any input mode)
 * 3. Compiler Checks: enabled/disabled (can be combined with any input mode)
 */

// ============================================================================
// Input Mode (Mutually Exclusive)
// ============================================================================

export const InputModeSchema = z.enum(['naive', 'template']);
export type InputMode = z.infer<typeof InputModeSchema>;

export interface TemplateOptions {
  templateName: string;
}

// ============================================================================
// Capability Configuration
// ============================================================================

export const CapabilityConfigSchema = z.object({
  // Input mode: how to start generation (naive vs template)
  inputMode: InputModeSchema.default('naive'),

  // Template options (required if inputMode is 'template')
  templateOptions: z
    .object({
      templateName: z.string(),
    })
    .optional(),

  // Planning: whether to generate architectural plan first
  planning: z.boolean().optional().default(false),

  // Compiler checks: whether to validate with TypeScript/Prisma and auto-fix errors
  compilerChecks: z.boolean().optional().default(false),

  // Compiler check iterations (only used if compilerChecks is true)
  maxIterations: z.number().int().min(1).max(5).optional().default(3),
});

// Use input type for creating configs (optional fields) and output type for using configs (with defaults applied)
export type CapabilityConfigInput = z.input<typeof CapabilityConfigSchema>;
export type CapabilityConfig = z.output<typeof CapabilityConfigSchema>;

// ============================================================================
// Capability Execution Context
// ============================================================================

/**
 * Context passed between capabilities during orchestration
 */
export interface CapabilityContext {
  /** Session ID for this generation */
  sessionId: string;

  /** User's prompt/requirement */
  prompt: string;

  /** Path to sandbox directory */
  sandboxPath: string;

  /** Accumulated token usage */
  tokens: {
    input: number;
    output: number;
    total: number;
  };

  /** Accumulated cost */
  cost: number;

  /** Number of tool calls executed so far */
  toolCalls: number;

  /** Start time of generation (for duration calculation) */
  startTime: number;

  /** Generated plan (if planning capability was used) */
  plan?: string;

  /** Template files copied (if template capability was used) */
  templateFiles?: string[];

  /** Validation results */
  validation?: {
    schemaValidationPassed?: boolean;
    typeCheckPassed?: boolean;
    errors?: Array<{
      file: string;
      line: number;
      column: number;
      code: string;
      message: string;
    }>;
  };

  /** Refinement iterations performed */
  refinementIterations?: number;

  /** Abort signal for cancellation */
  abortSignal: AbortSignal;
}

/**
 * Allowed fields for context updates returned by capabilities
 *
 * This type restricts which context fields capabilities can modify,
 * preventing accidental corruption of critical fields like sessionId or abortSignal.
 */
export type AllowedContextUpdates = Pick<
  CapabilityContext,
  'plan' | 'templateFiles' | 'validation' | 'refinementIterations'
>;

// ============================================================================
// Capability Results
// ============================================================================

/**
 * Result returned by a capability after execution
 */
export interface CapabilityResult {
  /** Whether capability execution was successful */
  success: boolean;

  /** Error message if capability failed */
  error?: string;

  /** Tokens used by this capability */
  tokensUsed?: {
    input: number;
    output: number;
  };

  /** Cost incurred by this capability */
  cost?: number;

  /** Number of tool calls made by this capability */
  toolCalls?: number;

  /**
   * Context updates to apply after this capability executes
   *
   * Only allowed fields can be updated (plan, templateFiles, validation, refinementIterations).
   * Critical fields like sessionId, abortSignal, sandboxPath cannot be modified.
   */
  contextUpdates?: Partial<AllowedContextUpdates>;
}

// ============================================================================
// Backward Compatibility Mapping
// ============================================================================

/**
 * Maps legacy strategy types to capability configurations
 */
export const strategyToCapabilityConfig: Record<string, CapabilityConfig> = {
  naive: {
    inputMode: 'naive',
    planning: false,
    compilerChecks: false,
    maxIterations: 3,
  },
  'plan-first': {
    inputMode: 'naive',
    planning: true,
    compilerChecks: false,
    maxIterations: 3,
  },
  template: {
    inputMode: 'template',
    templateOptions: {
      templateName: 'vite-fullstack-base',
    },
    planning: false,
    compilerChecks: false,
    maxIterations: 3,
  },
  'compiler-check': {
    inputMode: 'naive',
    planning: false,
    compilerChecks: true,
    maxIterations: 3,
  },
};

// ============================================================================
// Example Preset Configurations (for UI quick start)
// ============================================================================

export interface CapabilityPreset {
  id: string;
  label: string;
  description: string;
  config: CapabilityConfig;
}

export const CAPABILITY_PRESETS: readonly CapabilityPreset[] = [
  {
    id: 'naive',
    label: 'Quick Start',
    description: 'Direct prompt to code (fastest)',
    config: {
      inputMode: 'naive',
      planning: false,
      compilerChecks: false,
      maxIterations: 3,
    },
  },
  {
    id: 'naive-planning',
    label: 'Naive + Planning',
    description: 'Plan architecture, then code directly',
    config: {
      inputMode: 'naive',
      planning: true,
      compilerChecks: false,
      maxIterations: 3,
    },
  },
  {
    id: 'naive-checks',
    label: 'Naive + Checks',
    description: 'Direct coding with validation',
    config: {
      inputMode: 'naive',
      planning: false,
      compilerChecks: true,
      maxIterations: 3,
    },
  },
  {
    id: 'naive-full',
    label: 'Naive + Planning + Checks',
    description: 'Plan, code, and validate',
    config: {
      inputMode: 'naive',
      planning: true,
      compilerChecks: true,
      maxIterations: 3,
    },
  },
  {
    id: 'template',
    label: 'Template',
    description: 'Start from pre-built template',
    config: {
      inputMode: 'template',
      templateOptions: {
        templateName: 'vite-fullstack-base',
      },
      planning: false,
      compilerChecks: false,
      maxIterations: 3,
    },
  },
  {
    id: 'template-planning',
    label: 'Template + Planning',
    description: 'Template with architectural planning',
    config: {
      inputMode: 'template',
      templateOptions: {
        templateName: 'vite-fullstack-base',
      },
      planning: true,
      compilerChecks: false,
      maxIterations: 3,
    },
  },
  {
    id: 'template-checks',
    label: 'Template + Checks',
    description: 'Template with validation',
    config: {
      inputMode: 'template',
      templateOptions: {
        templateName: 'vite-fullstack-base',
      },
      planning: false,
      compilerChecks: true,
      maxIterations: 3,
    },
  },
  {
    id: 'template-full',
    label: 'Template + Planning + Checks',
    description: 'Full-featured template approach',
    config: {
      inputMode: 'template',
      templateOptions: {
        templateName: 'vite-fullstack-base',
      },
      planning: true,
      compilerChecks: true,
      maxIterations: 3,
    },
  },
] as const;
