import { usePresentationStore } from '../stores/presentationStore';
import { useReplayStore } from '../stores/replay.store';
import { transitions, focus } from '../lib/design-tokens';

/**
 * PresentationToggle - Toggle button for presentation mode
 *
 * A compact toggle button that shows active/inactive states with visual feedback.
 * Uses the design system for consistent styling.
 *
 * When activated:
 * - If not in replay mode, enters replay mode first (for completed/failed sessions)
 * - Automatically starts playback if not already playing
 * - Activates presentation mode overlays
 */
interface PresentationToggleProps {
  onEnterReplayMode?: () => Promise<void>;
  sessionStatus?: 'generating' | 'completed' | 'failed';
}

export function PresentationToggle({ onEnterReplayMode, sessionStatus }: PresentationToggleProps) {
  const { isEnabled, toggleEnabled } = usePresentationStore();
  const { isReplayMode, isPlaying, play } = useReplayStore();

  const handleToggle = async () => {
    // Don't allow presentation mode during active generation
    if (!isEnabled && sessionStatus === 'generating') {
      return;
    }

    // If entering presentation mode and not in replay mode yet, enter replay mode first
    if (!isEnabled && !isReplayMode && onEnterReplayMode) {
      await onEnterReplayMode();
      // Play will be triggered after replay mode is entered
      play();
    } else if (!isEnabled && isReplayMode && !isPlaying) {
      // If already in replay mode but not playing, start playback
      play();
    }

    toggleEnabled();
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`
        rounded border px-3 py-1 text-sm font-medium
        ${transitions.colors} ${focus.ring}
        ${
          isEnabled
            ? 'bg-purple-600 text-white border-purple-600 hover:bg-purple-700'
            : 'bg-card text-foreground border-border hover:border-border-hover hover:bg-muted'
        }
      `}
      aria-pressed={isEnabled}
      aria-label={isEnabled ? 'Exit presentation mode' : 'Enter presentation mode'}
    >
      Present
    </button>
  );
}
