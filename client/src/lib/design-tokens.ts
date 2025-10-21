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

// Dimensions
export const dimensions = {
  previewHeight: '600px', // Standard height for iframe previews
} as const;

// Spacing
export const spacing = {
  sections: 'space-y-6',
  controls: 'space-y-4',
  form: 'space-y-2',
  list: 'space-y-2',
  cards: 'space-y-4',
  componentGap: 'mt-6', // Gap between major components (24px)
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
  sectionHeader: 'text-base font-medium text-gray-900',
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

// Card styles
export const card = {
  base: `${radius.md} border border-gray-200 bg-white ${padding.card} ${transitions.all}`,
  interactive: `${radius.md} border border-gray-200 bg-white ${padding.card} ${transitions.all} cursor-pointer hover:border-gray-300 hover:shadow-sm`,
  link: `block ${radius.md} border border-gray-200 bg-white ${padding.card} ${transitions.all} hover:border-gray-300 hover:shadow-sm ${focus.ring}`,
  active: `border-gray-900 shadow-sm`,
  disabled: `opacity-50 cursor-not-allowed`,
} as const;

// Checkbox styles
export const checkbox = {
  wrapper: 'relative flex items-center',
  input:
    'peer h-4 w-4 cursor-pointer appearance-none rounded border border-gray-300 bg-white transition-colors checked:bg-gray-900 checked:border-gray-900 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50',
  inputReadOnly:
    'peer h-4 w-4 cursor-default appearance-none rounded border border-gray-900 bg-gray-900 transition-colors', // Always checked style, no hover/focus
  icon: 'pointer-events-none absolute left-0 top-0 h-4 w-4 text-white opacity-0 peer-checked:opacity-100',
} as const;

// Badge styles
export const badge = {
  base: `inline-flex items-center gap-1.5 ${radius.sm} px-2.5 py-1 text-xs font-medium ${transitions.colors}`,
  preset: `inline-flex items-center gap-1.5 ${radius.sm} px-3 py-1.5 text-sm font-medium border ${transitions.colors} cursor-pointer`,
  presetActive: 'bg-gray-900 text-white border-gray-900 hover:bg-gray-800',
  presetInactive: 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50',
  capability: 'bg-gray-100 text-gray-700 border border-gray-200',
} as const;

// Hover card (tooltip) styles
export const hoverCard = {
  trigger:
    'inline-flex items-center justify-center cursor-help text-gray-400 hover:text-gray-600 transition-colors',
  content: `absolute z-50 ${radius.md} border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 shadow-lg`,
  arrow: 'fill-white stroke-gray-200',
} as const;

// Capability icon colors
export const capabilityIcons = {
  codeGen: 'text-gray-900',
  planning: 'text-blue-600',
  template: 'text-purple-600',
  compiler: 'text-green-600',
} as const;
