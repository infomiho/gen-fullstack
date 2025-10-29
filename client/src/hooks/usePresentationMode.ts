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
 * Check if event target is an input element where we should ignore keyboard shortcuts
 */
function shouldIgnoreEvent(event: KeyboardEvent): boolean {
  return event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
}

/**
 * Check if a command can be executed based on its requirements
 */
function canExecuteCommand(
  command: KeyCommand,
  context: { isEnabled: boolean; isAutoPlaying: boolean },
): boolean {
  if (command.requiresEnabled && !context.isEnabled) return false;
  if (command.requiresPaused && context.isAutoPlaying) return false;
  return true;
}

/**
 * Find and execute matching keyboard command
 */
function executeMatchingCommand(
  event: KeyboardEvent,
  commands: KeyCommand[],
  context: { isEnabled: boolean; isAutoPlaying: boolean },
): boolean {
  for (const command of commands) {
    if (!command.keys.includes(event.key)) continue;
    if (!canExecuteCommand(command, context)) continue;

    const handled = command.handler(event, context);
    if (handled) {
      event.preventDefault();
      return true;
    }
  }
  return false;
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
      if (shouldIgnoreEvent(event)) return;

      const context = { isEnabled, isAutoPlaying };
      executeMatchingCommand(event, keyCommands, context);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEnabled, isAutoPlaying]);
}
