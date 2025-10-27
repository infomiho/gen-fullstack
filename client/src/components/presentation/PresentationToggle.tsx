import { usePresentationStore } from '../../stores/presentationStore';
import { transitions, focus } from '../../lib/design-tokens';

/**
 * PresentationToggle - Toggle button for presentation mode
 *
 * A compact toggle button that shows active/inactive states with visual feedback.
 * Uses the design system for consistent styling.
 *
 * Presentation mode is completely independent of replay mode.
 * Users can activate presentation mode on any session (live or completed)
 * without affecting replay mode state.
 */
interface PresentationToggleProps {
  sessionStatus?: 'generating' | 'completed' | 'failed';
}

export function PresentationToggle({ sessionStatus }: PresentationToggleProps) {
  const { isEnabled, toggleEnabled } = usePresentationStore();

  const handleToggle = () => {
    // Don't allow presentation mode during active generation
    if (!isEnabled && sessionStatus === 'generating') {
      return;
    }

    // Simply toggle presentation mode - completely independent of replay
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
