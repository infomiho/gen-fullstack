/**
 * Pipeline Visualization Design Tokens
 *
 * Design system tokens for the Railway-inspired pipeline visualization.
 * Uses semantic colors from the main design system for consistency.
 */

/**
 * Pipeline stage status colors
 *
 * Uses Tailwind classes for consistency with existing design system.
 * All colors use semantic variables that work with dark mode.
 */
export const stageStatus = {
  pending: {
    bg: 'bg-muted/30',
    border: 'border-border border-dashed',
    text: 'text-muted-foreground',
    icon: '⏱️',
  },
  started: {
    bg: 'bg-primary/10',
    border: 'border-primary border-2',
    text: 'text-primary',
    icon: '▶️',
    glow: 'shadow-[0_0_15px_rgba(59,130,246,0.3)] dark:shadow-[0_0_15px_rgba(96,165,250,0.3)]',
  },
  completed: {
    bg: 'bg-green-500/10',
    border: 'border-green-500 border-2',
    text: 'text-green-600 dark:text-green-400',
    icon: '✅',
  },
  failed: {
    bg: 'bg-red-500/10',
    border: 'border-red-500 border-2',
    text: 'text-red-600 dark:text-red-400',
    icon: '❌',
  },
} as const;

/**
 * Pipeline layout dimensions
 */
export const layout = {
  // Node dimensions
  nodeWidth: 200,
  nodeHeight: 100,

  // Spacing
  horizontalSpacing: 150,
  verticalCenter: 200,

  // Canvas
  canvasMinHeight: 500,
} as const;

/**
 * Pipeline stage display labels
 */
export const stageLabels = {
  template_loading: 'Template',
  planning: 'Planning',
  code_generation: 'Code Generation',
  validation: 'Validation',
  error_fixing: 'Error Fixing',
  completing: 'Completing',
} as const;

/**
 * Pipeline typography
 */
export const typography = {
  stageLabel: 'text-sm font-semibold',
  stageStatus: 'text-xs',
  stageDuration: 'text-xs font-mono',
  toolName: 'text-xs font-mono',
} as const;

/**
 * Pipeline animations
 */
export const animations = {
  // Smooth color transitions
  colorTransition: 'transition-colors duration-300',

  // Subtle pulse for active stage
  pulse: 'animate-pulse',

  // Brief shake for failed stage
  shake: 'animate-shake',
} as const;
