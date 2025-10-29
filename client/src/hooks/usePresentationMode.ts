import { useEffect } from 'react';
import { usePresentationStore } from '../stores/presentationStore';

/**
 * Keyboard command handler function type
 */
type KeyCommandHandler = (
  event: KeyboardEvent,
  context: { isEnabled: boolean; isAutoPlaying: boolean },
) => boolean; // Returns true if command was handled

/**
 * Key command configuration
 */
interface KeyCommand {
  /** Keys that trigger this command (case-insensitive) */
  keys: string[];
  /** Human-readable description */
  description: string;
  /** Whether command requires presentation mode to be enabled */
  requiresEnabled?: boolean;
  /** Whether command requires presentation to be paused */
  requiresPaused?: boolean;
  /** Handler function */
  handler: KeyCommandHandler;
}

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
    const {
      toggleEnabled,
      setEnabled,
      toggleMute,
      playPresentation,
      pausePresentation,
      nextEvent,
      previousEvent,
    } = usePresentationStore.getState();

    // Define all keyboard commands in a declarative mapping
    const keyCommands: KeyCommand[] = [
      {
        keys: ['p', 'P'],
        description: 'Toggle presentation mode',
        handler: () => {
          toggleEnabled();
          return true;
        },
      },
      {
        keys: [' '],
        description: 'Play/pause presentation',
        requiresEnabled: true,
        handler: (_event, { isAutoPlaying }) => {
          if (isAutoPlaying) {
            pausePresentation();
          } else {
            playPresentation();
          }
          return true;
        },
      },
      {
        keys: ['ArrowLeft'],
        description: 'Previous overlay',
        requiresEnabled: true,
        requiresPaused: true,
        handler: () => {
          previousEvent();
          return true;
        },
      },
      {
        keys: ['ArrowRight'],
        description: 'Next overlay',
        requiresEnabled: true,
        requiresPaused: true,
        handler: () => {
          nextEvent();
          return true;
        },
      },
      {
        keys: ['m', 'M'],
        description: 'Toggle audio mute',
        requiresEnabled: true,
        handler: () => {
          toggleMute();
          return true;
        },
      },
      {
        keys: ['Escape'],
        description: 'Exit presentation mode',
        requiresEnabled: true,
        handler: () => {
          setEnabled(false);
          return true;
        },
      },
    ];

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      const context = { isEnabled, isAutoPlaying };

      // Find matching command
      for (const command of keyCommands) {
        if (!command.keys.includes(event.key)) continue;

        // Check requirements
        if (command.requiresEnabled && !isEnabled) continue;
        if (command.requiresPaused && isAutoPlaying) continue;

        // Execute handler
        const handled = command.handler(event, context);
        if (handled) {
          event.preventDefault();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEnabled, isAutoPlaying]);
}
