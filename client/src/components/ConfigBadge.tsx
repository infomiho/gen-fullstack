import { radius, typography } from '../lib/design-tokens';

export interface ConfigBadgeProps {
  /** Whether the feature is enabled */
  enabled: boolean;
  /** The label to display (e.g., "Planning", "Compiler Checks") */
  label: string;
}

/**
 * ConfigBadge component - displays enabled/disabled status with color-coded badge
 *
 * Used to show configuration options with clear visual indicators:
 * - Green (emerald) badge for enabled features
 * - Gray badge for disabled features
 *
 * @example
 * ```tsx
 * <ConfigBadge enabled={true} label="Planning" />
 * <ConfigBadge enabled={false} label="Compiler Checks" />
 * ```
 */
export function ConfigBadge({ enabled, label }: ConfigBadgeProps) {
  return (
    <div className="flex items-center justify-between">
      <span className={typography.bodySecondary}>{label}:</span>
      <span
        className={`inline-flex items-center px-2 py-0.5 ${radius.sm} text-xs font-medium ${
          enabled
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-gray-100 text-gray-700 border border-gray-200'
        }`}
      >
        {enabled ? 'Enabled' : 'Disabled'}
      </span>
    </div>
  );
}
