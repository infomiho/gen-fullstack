import { AnimatePresence, motion } from 'motion/react';
import { usePresentationStore } from '../../stores/presentationStore';
import { ErrorBoundary } from '../ErrorBoundary';
import { GenerationStartOverlay } from './overlays/GenerationStartOverlay';
import { TemplateLoadingOverlay } from './overlays/TemplateLoadingOverlay';
import { PlanningOverlay } from './overlays/PlanningOverlay';
import { CodeGenerationOverlay } from './overlays/CodeGenerationOverlay';
import { BlockRequestOverlay } from './overlays/BlockRequestOverlay';
import { ToolCallHUD } from './overlays/ToolCallHUD';
import { ComboMilestoneOverlay } from './overlays/ComboMilestoneOverlay';
import { ValidationOverlay } from './overlays/ValidationOverlay';
import { ErrorFixingOverlay } from './overlays/ErrorFixingOverlay';
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
      {/* Constant background overlay - always visible when presentation mode is active */}
      <motion.div
        className="fixed inset-0 pointer-events-auto"
        style={{
          background:
            'radial-gradient(circle at center, rgba(0, 0, 0, 0.3) 0%, rgba(0, 0, 0, 0.5) 70%, rgba(0, 0, 0, 0.7) 100%)',
          zIndex: 1,
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
      />

      {/* Dynamic overlays on top of constant background */}
      <ErrorBoundary>
        <AnimatePresence mode="wait">
          {currentOverlay === 'generation-start' && <GenerationStartOverlay key="start" />}
          {currentOverlay === 'template-loading' && <TemplateLoadingOverlay key="template" />}
          {currentOverlay === 'planning' && <PlanningOverlay key="planning" />}
          {currentOverlay === 'code-generation' && <CodeGenerationOverlay key="code-gen" />}
          {currentOverlay === 'block-request' && <BlockRequestOverlay key="block" />}
          {currentOverlay === 'tool-hud' && <ToolCallHUD key="hud" />}
          {currentOverlay === 'combo-milestone' && <ComboMilestoneOverlay key="combo" />}
          {(currentOverlay === 'validation-prisma' ||
            currentOverlay === 'validation-typescript' ||
            currentOverlay === 'validation-result') && <ValidationOverlay key="validation" />}
          {currentOverlay === 'error-fixing' && <ErrorFixingOverlay key="fixing" />}
          {currentOverlay === 'file-created' && <FileCreatedOverlay key="file" />}
          {currentOverlay === 'error-ko' && <ErrorOverlay key="error" />}
          {currentOverlay === 'victory' && <VictoryOverlay key="victory" />}
        </AnimatePresence>
      </ErrorBoundary>
    </div>
  );
}
