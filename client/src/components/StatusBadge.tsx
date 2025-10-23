import { padding, typography } from '../lib/design-tokens';

export interface StatusBadgeProps {
  /** The status to display */
  status:
    | 'completed'
    | 'generating'
    | 'failed'
    | 'creating'
    | 'installing'
    | 'starting'
    | 'running'
    | 'ready'
    | 'stopped';
  /** Optional custom variant for styling override */
  variant?: 'session' | 'app' | 'default';
  /** Show live indicator with pulsing animation (for generating status) */
  showLiveIndicator?: boolean;
  /** Custom display text (defaults to status value) */
  displayText?: string;
  /** Uppercase the text (default: false for session status, true for app status) */
  uppercase?: boolean;
}

/**
 * StatusBadge component - displays status with color-coded badge
 *
 * Used to show session and app execution status with clear visual indicators:
 * - Green: running (app dev servers active)
 * - Amber: ready (container ready for commands)
 * - Gray: completed, stopped
 * - Blue: generating (LLM generation in progress)
 * - Red: failed
 *
 * Supports live indicator for active generating sessions with pulsing animation.
 *
 * @example
 * ```tsx
 * <StatusBadge status="generating" showLiveIndicator />
 * <StatusBadge status="ready" variant="app" />
 * <StatusBadge status="completed" displayText="Done" />
 * ```
 */
export function StatusBadge({
  status,
  variant = 'default',
  showLiveIndicator = false,
  displayText,
  uppercase = false,
}: StatusBadgeProps) {
  const getStatusColors = () => {
    switch (status) {
      // App execution statuses
      case 'running':
        return { dot: 'bg-green-600', border: 'border-green-600' };
      case 'ready':
        return { dot: 'bg-amber-600', border: 'border-amber-600' };

      // Intermediate app statuses (creating, installing, starting)
      case 'creating':
      case 'installing':
      case 'starting':
        return { dot: 'bg-blue-600', border: 'border-blue-600' };

      // Session statuses
      case 'generating':
        return { dot: 'bg-blue-600', border: 'border-blue-600' };

      case 'completed':
        return { dot: 'bg-green-600', border: 'border-green-600' }; // Success - green

      case 'stopped':
        return { dot: 'bg-gray-600', border: 'border-gray-600' }; // Neutral - gray

      case 'failed':
        return { dot: 'bg-red-600', border: 'border-red-600' }; // Error - red

      default:
        return { dot: 'bg-gray-600', border: 'border-gray-600' };
    }
  };

  const paddingClass = variant === 'app' ? padding.compact : 'px-2.5 py-1';
  const uppercaseClass = uppercase ? 'uppercase font-medium' : '';
  const colors = getStatusColors();

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border ${paddingClass} ${colors.border} bg-white ${typography.caption} text-gray-700 ${uppercaseClass}`}
    >
      {showLiveIndicator && status === 'generating' ? (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
        </span>
      ) : (
        <span className={`h-2 w-2 rounded-full ${colors.dot}`} />
      )}
      {displayText || status}
    </span>
  );
}
