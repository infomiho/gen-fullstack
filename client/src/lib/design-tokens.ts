/**
 * Design Tokens
 *
 * Centralized design system tokens for consistent styling across the application.
 * Now using CSS variables for automatic dark mode support.
 */

// Semantic role colors for timeline messages - now use CSS variable classes
export const roleColors = {
  assistant: {
    bg: 'bg-assistant-bg',
    icon: 'text-assistant-fg',
    border: 'border-assistant-border',
  },
  user: {
    bg: 'bg-user-bg',
    icon: 'text-user-fg',
    border: 'border-user-border',
  },
  system: {
    bg: 'bg-system-bg',
    icon: 'text-system-fg',
    border: 'border-system-border',
  },
  tool: {
    bg: 'bg-tool-bg',
    icon: 'text-tool-fg',
    border: 'border-tool-border',
  },
} as const;

// Base colors - semantic color classes
export const colors = {
  primary: 'primary',
  primaryHover: 'primary/80',
  secondary: 'muted-foreground',
  tertiary: 'muted-foreground/80',
  border: 'border',
  borderHover: 'border-hover',
  disabled: 'muted',
  disabledBg: 'muted',
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

// Typography - now uses semantic colors
export const typography = {
  sectionHeader: 'text-base font-medium text-foreground',
  label: 'text-sm font-medium text-foreground',
  body: 'text-sm text-foreground',
  bodySecondary: 'text-sm text-muted-foreground',
  caption: 'text-xs text-muted-foreground',
  mono: 'font-mono text-xs',
  monoSm: 'font-mono text-[0.65rem]',
} as const;

// Focus states - now uses semantic ring color
export const focus = {
  ring: 'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
  border: 'focus:border-primary',
} as const;

// Transitions
export const transitions = {
  colors: 'transition-colors duration-150',
  all: 'transition-all duration-150',
} as const;

// Common button styles - updated to use semantic colors
export const button = {
  // Primary button - dark, high emphasis
  primary: `w-full rounded border border-primary bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground ${transitions.colors} hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:border-muted disabled:text-muted-foreground ${focus.ring}`,
  // Secondary button - outlined, medium emphasis
  secondary: `rounded border px-4 py-2 text-sm font-medium border-border hover:border-border-hover hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed ${transitions.colors} ${focus.ring}`,
  // Tertiary button - subtle, low emphasis (for destructive actions like stop)
  tertiary: `w-full rounded border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground ${transitions.colors} hover:bg-muted hover:border-border-hover disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:border-border ${focus.ring}`,
} as const;

// Common input styles - updated to use semantic colors
export const input = {
  base: `w-full rounded border border-border ${padding.compact} ${typography.body} ${focus.border} ${focus.ring} disabled:bg-muted disabled:cursor-not-allowed ${transitions.colors}`,
  textarea: `w-full rounded border border-border px-3 py-2 ${typography.body} ${focus.border} ${focus.ring} disabled:bg-muted resize-none ${typography.mono}`,
  select: `w-full rounded border border-border bg-card ${padding.compact} ${typography.body} ${focus.border} ${focus.ring} disabled:bg-muted ${transitions.colors}`,
} as const;

// Card styles - updated to use semantic colors
export const card = {
  base: `${radius.md} border border-border bg-card ${padding.card} ${transitions.all}`,
  interactive: `${radius.md} border border-border bg-card ${padding.card} ${transitions.all} cursor-pointer hover:border-border-hover hover:shadow-sm`,
  link: `block ${radius.md} border border-border bg-card ${padding.card} ${transitions.all} hover:border-border-hover hover:shadow-sm ${focus.ring}`,
  active: `border-primary shadow-sm`,
  disabled: `opacity-50 cursor-not-allowed`,
} as const;

// Checkbox styles - updated to use semantic colors
export const checkbox = {
  wrapper: 'relative flex items-center',
  input:
    'peer h-4 w-4 cursor-pointer appearance-none rounded border border-border bg-card transition-colors checked:bg-primary checked:border-primary hover:border-border-hover focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50',
  inputReadOnly:
    'peer h-4 w-4 cursor-default appearance-none rounded border border-primary bg-primary transition-colors', // Always checked style, no hover/focus
  icon: 'pointer-events-none absolute left-0 top-0 h-4 w-4 text-primary-foreground opacity-0 peer-checked:opacity-100',
} as const;

// Badge styles - updated to use semantic colors
export const badge = {
  base: `inline-flex items-center gap-1.5 ${radius.sm} px-2.5 py-1 text-xs font-medium ${transitions.colors}`,
  preset: `inline-flex items-center gap-1.5 ${radius.sm} px-3 py-1.5 text-sm font-medium border ${transitions.colors} cursor-pointer`,
  presetActive: 'bg-primary text-primary-foreground border-primary hover:bg-primary/90',
  presetInactive: 'bg-card text-foreground border-border hover:border-border-hover hover:bg-muted',
  capability: 'bg-muted text-foreground border border-border',
} as const;

// Hover card (tooltip) styles - updated to use semantic colors
export const hoverCard = {
  trigger:
    'inline-flex items-center justify-center cursor-help text-muted-foreground hover:text-foreground transition-colors',
  content: `absolute z-50 ${radius.md} border border-border bg-card px-3 py-2 text-xs text-foreground shadow-lg`,
  arrow: 'fill-card stroke-border',
} as const;

// Container styles - for visual grouping in sidebars
export const container = {
  // Light container with subtle border and background
  light: `${radius.md} border border-border bg-muted/30 p-3`,
  // Solid container (like PromptDisplay)
  solid: `${radius.md} border border-border bg-muted p-3`,
  // Plain - no background (like MetricsDisplay)
  plain: '',
} as const;

// Link styles - for external and internal links
export const link = {
  // Primary link with underline
  primary:
    'text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline transition-colors',
  // Small link (for compact spaces)
  small:
    'text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline transition-colors',
  // Subtle link without underline
  subtle: 'text-muted-foreground hover:text-foreground transition-colors',
} as const;

// Capability icon colors - now use CSS variables
export const capabilityIcons = {
  codeGen: 'text-capability-codegen',
  planning: 'text-capability-planning',
  template: 'text-capability-template',
  compiler: 'text-capability-compiler',
  blocks: 'text-capability-blocks',
} as const;
