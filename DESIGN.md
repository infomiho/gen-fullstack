# Design System Documentation

## Overview

Gen Fullstack uses a centralized design system implemented through design tokens to ensure consistency, maintainability, and semantic clarity across the application. All visual styling decisions are codified in `client/src/lib/design-tokens.ts`.

## Philosophy

- **Semantic over Arbitrary**: Colors and styles have semantic meaning (e.g., role-based colors for different message types)
- **Centralized Tokens**: All design decisions in one place for easy maintenance
- **TypeScript-First**: Type-safe design tokens with const assertions
- **Tailwind Integration**: Tokens are exported as Tailwind class strings for direct use
- **Consistency**: Reusable patterns for common UI elements (buttons, inputs, focus states)

## Design Tokens

### 1. Role Colors

Semantic colors for timeline messages and events, providing visual differentiation based on role:

```typescript
roleColors = {
  assistant: {
    bg: 'bg-blue-50',      // Light blue background
    icon: 'text-blue-600',  // Blue icons
    border: 'border-blue-100'
  },
  user: {
    bg: 'bg-gray-50',       // Light gray background
    icon: 'text-gray-600',  // Gray icons
    border: 'border-gray-200'
  },
  system: {
    bg: 'bg-amber-50',      // Light amber background
    icon: 'text-amber-600', // Amber icons
    border: 'border-amber-100'
  },
  tool: {
    bg: 'bg-gray-50',       // Light gray background
    icon: 'text-gray-500',  // Lighter gray icons
    border: 'border-gray-200'
  }
}
```

**Usage:**
```tsx
const colors = roleColors[message.role];
return (
  <div className={`${colors.bg} ${colors.border} border`}>
    <Icon className={colors.icon} />
  </div>
);
```

### 2. Base Colors

Foundation colors for text, borders, and interactive elements:

```typescript
colors = {
  primary: 'gray-900',        // Main text, primary buttons
  primaryHover: 'gray-800',   // Hover state for primary
  secondary: 'gray-600',      // Secondary text
  tertiary: 'gray-500',       // Tertiary/disabled text
  border: 'gray-200',         // Default borders
  borderHover: 'gray-300',    // Hover state for borders
  disabled: 'gray-300',       // Disabled button background
  disabledBg: 'gray-50'       // Disabled input background
}
```

**Usage:**
```tsx
<div className={`text-${colors.primary} border-${colors.border}`}>
```

### 3. Border Radius

Consistent rounding for different element types:

```typescript
radius = {
  sm: 'rounded',      // 4px - for small elements (code blocks, badges)
  md: 'rounded-lg'    // 8px - for cards, panels, dialogs
}
```

**When to use:**
- **sm**: Code blocks, tags, small badges, compact controls
- **md**: Cards, panels, modals, large containers

### 4. Spacing

Vertical spacing scales for different content groupings:

```typescript
spacing = {
  sections: 'space-y-6',  // Major sections
  controls: 'space-y-4',  // Control groups
  form: 'space-y-2',      // Form fields
  list: 'space-y-2',      // List items
  cards: 'space-y-4'      // Card grids
}
```

**Usage:**
```tsx
<div className={spacing.controls}>
  {/* Children get 16px vertical spacing */}
</div>
```

### 5. Padding

Consistent internal padding for components:

```typescript
padding = {
  page: 'px-6 py-4',    // Page-level containers
  panel: 'p-4',         // Panels and sections
  card: 'p-4',          // Card elements
  button: 'px-4 py-2',  // Buttons
  compact: 'px-2 py-1'  // Compact inputs/controls
}
```

### 6. Typography

Text styles for different semantic purposes:

```typescript
typography = {
  header: 'text-xs font-medium text-gray-500 uppercase tracking-wide',
  label: 'text-sm font-medium text-gray-700',
  body: 'text-sm text-gray-800',
  bodySecondary: 'text-sm text-gray-600',
  caption: 'text-xs text-gray-500',
  mono: 'font-mono text-xs',
  monoSm: 'font-mono text-[0.65rem]'
}
```

**When to use:**
- **header**: Section headers, group labels (e.g., "PARAMETERS", "ROLE")
- **label**: Form labels, button text, emphasized text
- **body**: Main content, paragraph text
- **bodySecondary**: De-emphasized text, descriptions
- **caption**: Timestamps, metadata, status indicators
- **mono**: Code, file paths, command text
- **monoSm**: Timestamps in tight spaces, compact code

### 7. Focus States

Consistent focus indicators for accessibility:

```typescript
focus = {
  ring: 'focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:ring-offset-1',
  border: 'focus:border-gray-900'
}
```

**Apply to:**
- All interactive elements (buttons, inputs, links)
- Modal close buttons
- Custom interactive components

### 8. Transitions

Standard transition durations for smooth interactions:

```typescript
transitions = {
  colors: 'transition-colors duration-150',  // Color changes
  all: 'transition-all duration-150'         // All properties
}
```

**Usage:**
- `colors`: Hover states, color changes
- `all`: Transforms, opacity, multiple property changes

### 9. Common Component Styles

#### Buttons

```typescript
button = {
  primary: 'rounded px-4 py-2 text-sm font-medium text-white bg-gray-900
            hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed
            transition-colors duration-150 focus:ring-2 ...',

  secondary: 'rounded px-4 py-2 text-sm font-medium border border-gray-200
              hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50
              disabled:cursor-not-allowed ...'
}
```

#### Inputs

```typescript
input = {
  base: 'w-full rounded border border-gray-200 px-2 py-1 text-sm
         focus:border-gray-900 focus:ring-2 ...',

  textarea: 'w-full rounded border border-gray-200 px-3 py-2 text-sm
             font-mono resize-none focus:border-gray-900 focus:ring-2 ...',

  select: 'w-full rounded border border-gray-200 bg-white px-2 py-1 text-sm
           focus:border-gray-900 focus:ring-2 ...'
}
```

## Usage Patterns

### 1. Timeline Messages

```tsx
import { roleColors, radius, padding, typography } from '../lib/design-tokens';

function MessageItem({ message }) {
  const colors = roleColors[message.role];

  return (
    <div className={`flex gap-3 ${radius.md} ${padding.card} border
                    ${colors.bg} ${colors.border}`}>
      <Icon className={colors.icon} />
      <div>
        <div className={typography.caption}>{message.role}</div>
        <div className={typography.body}>{message.content}</div>
      </div>
    </div>
  );
}
```

### 2. Form Inputs

```tsx
import { input, spacing, focus } from '../lib/design-tokens';

function Form() {
  return (
    <form className={spacing.form}>
      <textarea className={`${input.textarea} ${focus.ring}`} />
      <button type="submit" className={button.primary}>
        Submit
      </button>
    </form>
  );
}
```

### 3. Modal Dialogs

```tsx
import { radius, padding, spacing, typography } from '../lib/design-tokens';

function Modal() {
  return (
    <div className={`${radius.md} bg-white ${padding.panel} shadow-lg`}>
      <h2 className={`${typography.label} text-lg mb-4`}>Title</h2>
      <div className={spacing.controls}>
        {/* Modal content */}
      </div>
    </div>
  );
}
```

### 4. Interactive Cards

```tsx
import { roleColors, radius, padding, transitions, focus } from '../lib/design-tokens';

function ToolCard({ tool }) {
  return (
    <button className={`${radius.md} ${padding.card} ${roleColors.tool.bg}
                       border ${roleColors.tool.border} hover:border-gray-300
                       hover:bg-white ${transitions.colors} ${focus.ring}`}>
      {/* Card content */}
    </button>
  );
}
```

## Best Practices

### 1. Always Import from Design Tokens

```tsx
// ✅ Good
import { typography, spacing } from '../lib/design-tokens';

// ❌ Bad - hardcoded values
<div className="text-sm text-gray-800 space-y-2">
```

### 2. Use Semantic Role Colors

```tsx
// ✅ Good - semantic meaning
const colors = roleColors[message.role];

// ❌ Bad - arbitrary colors
<div className="bg-blue-50 border-blue-100">
```

### 3. Compose Tokens, Don't Modify

```tsx
// ✅ Good - compose existing tokens
<div className={`${radius.md} ${padding.card} ${spacing.form}`}>

// ❌ Bad - one-off values
<div className="rounded-xl p-5 space-y-3">
```

### 4. Apply Focus States Everywhere

```tsx
// ✅ Good
<button className={`... ${focus.ring}`}>

// ❌ Bad - no focus indicator
<button className="...">
```

### 5. Use Transitions for Interactive Elements

```tsx
// ✅ Good
<button className={`... hover:bg-gray-800 ${transitions.colors}`}>

// ❌ Bad - abrupt changes
<button className="... hover:bg-gray-800">
```

## Component Categories

### Layout Components
- Use: `padding.page`, `padding.panel`, `spacing.sections`
- Examples: App wrapper, main containers, section dividers

### Form Components
- Use: `input.*`, `button.*`, `spacing.form`, `focus.*`
- Examples: PromptInput, StrategySelector

### Display Components
- Use: `roleColors`, `typography.*`, `spacing.list`
- Examples: Timeline, MessageItem, ToolItem

### Interactive Components
- Use: `transitions.*`, `focus.*`, `radius.md`
- Examples: Buttons, modals, expandable cards

## Extending the System

When adding new design tokens:

1. **Define semantically**: Name tokens by purpose, not appearance
2. **Add to appropriate category**: Colors, spacing, typography, etc.
3. **Use const assertion**: `as const` for type safety
4. **Document usage**: Add comments and examples
5. **Update this document**: Keep DESIGN.md in sync

Example:
```typescript
// In design-tokens.ts
export const elevation = {
  low: 'shadow-sm',
  medium: 'shadow-md',
  high: 'shadow-lg'
} as const;
```

## Migration Guide

When refactoring components to use design tokens:

1. **Identify patterns**: Look for repeated style combinations
2. **Replace with tokens**: Swap hardcoded classes with token imports
3. **Test visually**: Ensure appearance matches
4. **Remove inline styles**: Replace with appropriate tokens
5. **Update component docs**: Document token usage

## Accessibility

The design system includes built-in accessibility features:

- **Focus indicators**: High-contrast focus rings on all interactive elements
- **Semantic colors**: Meaningful color differentiation beyond color alone
- **Proper contrast**: Text colors meet WCAG AA standards
- **Keyboard navigation**: Focus states support keyboard-only users

## Performance Considerations

- **Tree-shaking**: Unused tokens are eliminated in production builds
- **No runtime overhead**: Tokens compile to static Tailwind classes
- **Minimal bundle impact**: String constants don't add significant size
- **Type safety**: Catch errors at compile time, not runtime

## Related Files

- `/client/src/lib/design-tokens.ts` - Token definitions
- `/client/src/components/Timeline.tsx` - Complex usage example
- `/client/src/components/PromptInput.tsx` - Form usage example
- `/client/src/components/StrategySelector.tsx` - Select/button usage
- `/CLAUDE.md` - Project context and architecture
