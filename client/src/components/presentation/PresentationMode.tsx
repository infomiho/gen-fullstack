import { AnimatePresence } from 'motion/react';
import { usePresentationStore } from '../../stores/presentationStore';
import { GenerationStartOverlay } from './overlays/GenerationStartOverlay';
import { ToolCallHUD } from './overlays/ToolCallHUD';
import { FileCreatedOverlay } from './overlays/FileCreatedOverlay';
import { ErrorOverlay } from './overlays/ErrorOverlay';
import { VictoryOverlay } from './overlays/VictoryOverlay';

/**
 * PresentationMode: Fighting Game Arena Style
 *
 * Full-screen overlay system for conference presentations and live demos.
 * Transforms generation events into dramatic, stage-visible spectacles.
 *
 * Features:
 * - "READY... FIGHT!" generation start sequence
 * - Live tool call HUD with combo counter
 * - File creation achievement toasts
 * - "K.O." error screens with shake effects
 * - Victory screens with stats and fireworks
 *
 * Keyboard shortcuts:
 * - P: Toggle presentation mode
 * - M: Toggle audio mute
 * - Escape: Exit presentation mode
 */
export function PresentationMode() {
  const { isEnabled, currentOverlay } = usePresentationStore();

  if (!isEnabled) {
    return null;
  }

  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 10000 }} aria-live="polite">
      <AnimatePresence mode="wait">
        {currentOverlay === 'generation-start' && <GenerationStartOverlay key="start" />}
        {currentOverlay === 'tool-hud' && <ToolCallHUD key="hud" />}
        {currentOverlay === 'file-created' && <FileCreatedOverlay key="file" />}
        {currentOverlay === 'error-ko' && <ErrorOverlay key="error" />}
        {currentOverlay === 'victory' && <VictoryOverlay key="victory" />}
      </AnimatePresence>
    </div>
  );
}
