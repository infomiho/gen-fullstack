import { padding, typography } from '../lib/design-tokens';

export interface StatusBadgeProps {
  /** The status to display */
  status:
    | 'completed'
    | 'generating'
    | 'failed'
    | 'running'
    | 'creating'
    | 'installing'
    | 'starting'
    | 'stopped'
    | 'idle';
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
 * - Green: running (app execution)
 * - Gray: completed, stopped, idle
 * - Blue: generating, creating, installing, starting
 * - Red: failed
 *
 * Supports live indicator for active generating sessions with pulsing animation.
 *
 * @example
 * ```tsx
 * <StatusBadge status="generating" showLiveIndicator />
 * <StatusBadge status="running" variant="app" />
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
  const getStatusColor = () => {
    switch (status) {
      // App execution statuses
      case 'running':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'creating':
      case 'installing':
      case 'starting':
        return 'bg-blue-100 text-blue-800 border-blue-200';

      // Session statuses
      case 'generating':
        return 'bg-blue-100 text-blue-700';

      case 'completed':
      case 'stopped':
        return 'bg-gray-100 text-gray-700';

      case 'idle':
        return 'bg-gray-100 text-gray-600';

      case 'failed':
        return status === 'failed' && variant === 'app'
          ? 'bg-red-100 text-red-800 border-red-200'
          : 'bg-red-100 text-red-700';

      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  // App variant includes border
  const borderClass = variant === 'app' ? 'border' : '';
  const paddingClass = variant === 'app' ? padding.compact : 'px-2 py-0.5';
  const uppercaseClass = uppercase ? 'uppercase font-medium' : '';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded ${paddingClass} ${borderClass} ${getStatusColor()} ${typography.caption} ${uppercaseClass}`}
    >
      {showLiveIndicator && status === 'generating' && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
        </span>
      )}
      {showLiveIndicator && status === 'generating' ? 'Live' : displayText || status}
    </span>
  );
}
