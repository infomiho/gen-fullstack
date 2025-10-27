/**
 * Presentation Mode - Single Entry Point
 *
 * This module provides a self-contained presentation system for stage demos.
 * To remove presentation mode entirely, delete:
 * 1. client/src/components/presentation/ (this directory)
 * 2. client/src/stores/presentationStore.ts
 * 3. client/src/lib/presentation-tokens.ts
 * 4. client/src/lib/presentation-queue-builder.ts
 * 5. Remove imports from SessionPage.tsx
 */

// Main component
export { PresentationMode } from './PresentationMode';

// UI Controls
export { PresentationToggle } from './PresentationToggle';

// Hooks
export { usePresentationMode } from '../../hooks/usePresentationMode';
export { usePresentationPlayback } from '../../hooks/usePresentationPlayback';

// Store
export { usePresentationStore } from '../../stores/presentationStore';

// Queue builder
export { buildPresentationQueue } from '../../lib/presentation-queue-builder';

// Types (re-export from store)
export type { PresentationEvent } from '../../stores/presentationStore';
