import { useEffect } from 'react';
import { usePresentationStore } from '../stores/presentationStore';

/**
 * Hook for managing presentation mode keyboard shortcuts
 *
 * Keyboard shortcuts:
 * - P: Toggle presentation mode
 * - Space: Play/pause presentation (when active)
 * - Left/Right arrows: Navigate between overlays (when paused)
 * - M: Toggle audio mute (when presentation mode is active)
 * - Escape: Exit presentation mode
 */
export function usePresentationMode() {
  const isEnabled = usePresentationStore((state) => state.isEnabled);
  const isAutoPlaying = usePresentationStore((state) => state.isAutoPlaying);

  useEffect(() => {
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Keyboard event handler needs multiple conditionals for different key combinations
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      const {
        toggleEnabled,
        setEnabled,
        toggleMute,
        playPresentation,
        pausePresentation,
        nextEvent,
        previousEvent,
      } = usePresentationStore.getState();

      // P key: Toggle presentation mode
      if (event.key === 'p' || event.key === 'P') {
        event.preventDefault();
        toggleEnabled();
        return;
      }

      // Only process these keys when presentation mode is active
      if (isEnabled) {
        // Space: Play/pause
        if (event.key === ' ') {
          event.preventDefault();
          if (isAutoPlaying) {
            pausePresentation();
          } else {
            playPresentation();
          }
          return;
        }

        // Left arrow: Previous overlay (when paused)
        if (event.key === 'ArrowLeft' && !isAutoPlaying) {
          event.preventDefault();
          previousEvent();
          return;
        }

        // Right arrow: Next overlay (when paused)
        if (event.key === 'ArrowRight' && !isAutoPlaying) {
          event.preventDefault();
          nextEvent();
          return;
        }

        // M key: Toggle mute
        if (event.key === 'm' || event.key === 'M') {
          event.preventDefault();
          toggleMute();
          return;
        }

        // Escape: Exit presentation mode
        if (event.key === 'Escape') {
          event.preventDefault();
          setEnabled(false);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEnabled, isAutoPlaying]);
}
