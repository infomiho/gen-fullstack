# Presentation Mode

Fighting game-style presentation overlay system for stage demos and conference presentations.

## Features

- 🎮 **10 Dramatic Overlays**: Generation start, planning, file creation, validations, victory
- ⌨️ **Keyboard Controls**: P (toggle), Space/Arrows (playback), M (mute), Escape (exit)
- 🎨 **Neon Aesthetic**: Tekken/Street Fighter inspired with stage-visible typography
- 🎊 **Particle Effects**: Confetti for files, fireworks for victory
- 📊 **Live Stats**: Combo counter, tool budget, file count tracking

## Architecture

### Components (2,183 lines total)

```
PresentationMode.tsx              - Main wrapper and overlay orchestrator
PresentationToggle.tsx            - Toggle button for SessionPage
overlays/
  ├── GenerationStartOverlay.tsx  - "READY... FIGHT!" sequence
  ├── TemplateLoadingOverlay.tsx  - Template mode intro
  ├── PlanningOverlay.tsx         - Architecture planning items
  ├── BlockRequestOverlay.tsx     - Building block requests
  ├── ToolCallHUD.tsx             - Live tool tracking overlay
  ├── ComboMilestoneOverlay.tsx   - File combo achievements
  ├── ValidationOverlay.tsx       - Compiler check loading + results
  ├── FileCreatedOverlay.tsx      - File creation toasts
  ├── ErrorOverlay.tsx            - K.O. error screen
  └── VictoryOverlay.tsx          - Victory stats screen
```

### Supporting Files

- **Store**: `stores/presentationStore.ts` (352 lines) - Zustand state management
- **Queue Builder**: `lib/presentation-queue-builder.ts` (211 lines) - Maps timeline to overlays
- **Design Tokens**: `lib/presentation-tokens.ts` (117 lines) - Colors, typography, animations
- **Hooks**:
  - `hooks/usePresentationMode.ts` - Keyboard shortcuts (P, M, Escape)
  - `hooks/usePresentationPlayback.ts` - Auto-advance through events

## Integration Points

### SessionPage.tsx (Only Integration Point)

```typescript
// Single import for all presentation features
import {
  PresentationMode,
  PresentationToggle,
  usePresentationMode,
  usePresentationPlayback,
  buildPresentationQueue,
  usePresentationStore,
} from '../components/presentation';

// Usage:
const { isEnabled } = usePresentationStore();
usePresentationMode(); // Setup keyboard listeners
usePresentationPlayback(); // Auto-advance overlays

// Build queue when entering presentation mode
const queue = buildPresentationQueue(messages, toolCalls, toolResults, config);

// Render
<PresentationToggle sessionStatus={session.status} />
<PresentationMode />
```

## How to Remove Presentation Mode

If you want to remove presentation mode entirely:

### 1. Delete Files (5 items)
```bash
# From project root
rm -rf client/src/components/presentation/
rm client/src/stores/presentationStore.ts
rm client/src/lib/presentation-tokens.ts
rm client/src/lib/presentation-queue-builder.ts
rm client/src/hooks/usePresentationMode.ts
rm client/src/hooks/usePresentationPlayback.ts
```

### 2. Update SessionPage.tsx

Remove the import block:
```typescript
// DELETE THIS BLOCK
import {
  PresentationMode,
  PresentationToggle,
  usePresentationMode,
  usePresentationPlayback,
  buildPresentationQueue,
  usePresentationStore,
} from '../components/presentation';
```

Remove hook calls in component body (around line 209, 343):
```typescript
// DELETE THESE
usePresentationMode();
usePresentationPlayback();
```

Remove presentation-related logic (around line 310-337):
```typescript
// DELETE THIS BLOCK
const { isEnabled } = usePresentationStore();
useEffect(() => {
  if (isEnabled && persistedData) {
    const queue = buildPresentationQueue(...);
    // ... presentation queue setup
  }
}, [isEnabled, persistedData]);
```

Remove toggle button render (around line 480):
```typescript
// DELETE THIS
<PresentationToggle sessionStatus={session.status} />
```

Remove overlay render (around line 533):
```typescript
// DELETE THIS
<PresentationMode />
```

### 3. Remove Dependencies (Optional)

If you're not using these packages elsewhere:
```bash
pnpm remove @tsparticles/react @tsparticles/slim @tsparticles/engine
```

### 4. Verify TypeCheck Passes
```bash
pnpm --filter client typecheck
```

## Design Philosophy

- **Decoupled**: All presentation code isolated in this directory
- **Single Entry Point**: Import everything from `components/presentation/`
- **Independent**: Works with both live generations and replay mode
- **No Side Effects**: Presentation doesn't affect generation or replay state
- **Easily Removable**: Delete 5 files + update 1 file = complete removal

## Performance Notes

- Animations optimized with `ease: 'easeOut'` instead of spring physics
- Uses `willChange` CSS property for transform-heavy animations
- Minimal re-renders with Zustand store selectors
- Particle effects use tsParticles slim bundle
