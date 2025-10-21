import { radius, typography } from '../lib/design-tokens';

export interface ConfigValueProps {
  /** The label to display (e.g., "Input Mode", "Model") */
  label: string;
  /** The value to display (e.g., "Template", "Naive", "gpt-5-mini") */
  value: string;
  /** Optional color variant for the badge */
  variant?: 'blue' | 'purple' | 'gray';
}

/**
 * ConfigValue component - displays a configuration value with a colored badge
 *
 * Used to show informational configuration values with visual distinction.
 * Default variant is blue, but can be customized for different types of values.
 *
 * @example
 * ```tsx
 * <ConfigValue label="Input Mode" value="Template" />
 * <ConfigValue label="Model" value="gpt-5-mini" variant="purple" />
 * ```
 */
export function ConfigValue({ label, value, variant = 'blue' }: ConfigValueProps) {
  const variantStyles = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    gray: 'bg-gray-100 text-gray-700 border-gray-200',
  };

  return (
    <div className="flex items-center justify-between">
      <span className={typography.bodySecondary}>{label}:</span>
      <span
        className={`inline-flex items-center px-2 py-0.5 ${radius.sm} text-xs font-medium border ${variantStyles[variant]}`}
      >
        {value}
      </span>
    </div>
  );
}
