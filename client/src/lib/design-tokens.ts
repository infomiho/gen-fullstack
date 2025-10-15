/**
 * Design Tokens
 *
 * Centralized design system tokens for consistent styling across the application.
 * Semantic colors are used for meaningful differentiation, while maintaining
 * a clean, professional aesthetic.
 */

// Semantic role colors for timeline messages
export const roleColors = {
  assistant: {
    bg: 'bg-blue-50',
    icon: 'text-blue-600',
    border: 'border-blue-100',
  },
  user: {
    bg: 'bg-gray-50',
    icon: 'text-gray-600',
    border: 'border-gray-200',
  },
  system: {
    bg: 'bg-amber-50',
    icon: 'text-amber-600',
    border: 'border-amber-100',
  },
  tool: {
    bg: 'bg-gray-50',
    icon: 'text-gray-500',
    border: 'border-gray-200',
  },
} as const;

// Base colors
export const colors = {
  primary: 'gray-900',
  primaryHover: 'gray-800',
  secondary: 'gray-600',
  tertiary: 'gray-500',
  border: 'gray-200',
  borderHover: 'gray-300',
  disabled: 'gray-300',
  disabledBg: 'gray-50',
} as const;

// Border radius
export const radius = {
  sm: 'rounded', // 4px - for small elements
  md: 'rounded-lg', // 8px - for cards/panels
} as const;

// Spacing
export const spacing = {
  sections: 'space-y-6',
  controls: 'space-y-4',
  form: 'space-y-2',
  list: 'space-y-2',
  cards: 'space-y-4',
} as const;

// Padding
export const padding = {
  page: 'px-6 py-4',
  panel: 'p-4',
  card: 'p-4',
  button: 'px-4 py-2',
  compact: 'px-2 py-1',
} as const;

// Typography
export const typography = {
  header: 'text-xs font-medium text-gray-500 uppercase tracking-wide',
  label: 'text-sm font-medium text-gray-700',
  body: 'text-sm text-gray-800',
  bodySecondary: 'text-sm text-gray-600',
  caption: 'text-xs text-gray-500',
  mono: 'font-mono text-xs',
  monoSm: 'font-mono text-[0.65rem]',
} as const;

// Focus states
export const focus = {
  ring: 'focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:ring-offset-1',
  border: 'focus:border-gray-900',
} as const;

// Transitions
export const transitions = {
  colors: 'transition-colors duration-150',
  all: 'transition-all duration-150',
} as const;

// Common button styles
export const button = {
  // Primary button - dark, high emphasis
  primary: `w-full rounded border border-gray-900 bg-gray-900 px-4 py-2.5 text-sm font-medium text-white ${transitions.colors} hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:border-gray-300 ${focus.ring}`,
  // Secondary button - outlined, medium emphasis
  secondary: `rounded border px-4 py-2 text-sm font-medium border-gray-200 hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed ${transitions.colors} ${focus.ring}`,
  // Tertiary button - subtle, low emphasis (for destructive actions like stop)
  tertiary: `w-full rounded border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 ${transitions.colors} hover:bg-gray-50 hover:border-gray-400 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 ${focus.ring}`,
} as const;

// Common input styles
export const input = {
  base: `w-full rounded border border-${colors.border} ${padding.compact} ${typography.body} ${focus.border} ${focus.ring} disabled:bg-${colors.disabledBg} disabled:cursor-not-allowed ${transitions.colors}`,
  textarea: `w-full rounded border border-${colors.border} px-3 py-2 ${typography.body} ${focus.border} ${focus.ring} disabled:bg-${colors.disabledBg} resize-none ${typography.mono}`,
  select: `w-full rounded border border-${colors.border} bg-white ${padding.compact} ${typography.body} ${focus.border} ${focus.ring} disabled:bg-${colors.disabledBg} ${transitions.colors}`,
} as const;
