import { CAPABILITY_BADGE_STYLES } from '../lib/capability-metadata';

interface CapabilityBadgeProps {
  capability: 'planning' | 'compilerChecks' | 'buildingBlocks';
}

/**
 * CapabilityBadge component
 *
 * Displays a small badge for an enabled capability (Planning, Compiler Checks, or Building Blocks)
 * Uses centralized capability badge styles for consistent styling across the app.
 */
export function CapabilityBadge({ capability }: CapabilityBadgeProps) {
  const styles = CAPABILITY_BADGE_STYLES[capability];
  const Icon = styles.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${styles.bgColor} ${styles.textColor} ${styles.borderColor}`}
    >
      <Icon className="h-3 w-3" />
      {styles.shortLabel}
    </span>
  );
}
