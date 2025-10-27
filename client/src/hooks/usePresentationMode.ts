import { useEffect } from 'react';
import { usePresentationStore } from '../stores/presentationStore';

/**
 * Hook for managing presentation mode keyboard shortcuts
 *
 * Keyboard shortcuts:
 * - P: Toggle presentation mode
 * - M: Toggle audio mute (when presentation mode is active)
 * - Escape: Exit presentation mode
 */
export function usePresentationMode() {
  const { isEnabled, toggleEnabled, toggleMute, setEnabled } = usePresentationStore();

  useEffect(() => {
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Keyboard event handler needs multiple conditionals for different key combinations
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      // P key: Toggle presentation mode
      if (event.key === 'p' || event.key === 'P') {
        event.preventDefault();
        toggleEnabled();
      }

      // Only process these keys when presentation mode is active
      if (isEnabled) {
        // M key: Toggle mute
        if (event.key === 'm' || event.key === 'M') {
          event.preventDefault();
          toggleMute();
        }

        // Escape: Exit presentation mode
        if (event.key === 'Escape') {
          event.preventDefault();
          setEnabled(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEnabled, toggleEnabled, toggleMute, setEnabled]);

  return {
    isEnabled,
    toggleEnabled,
  };
}
