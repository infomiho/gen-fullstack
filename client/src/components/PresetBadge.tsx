import type { LucideIcon } from 'lucide-react';
import { badge } from '../lib/design-tokens';

export interface PresetBadgeProps {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  active: boolean;
  disabled?: boolean;
}

/**
 * Preset selector badge - clickable badge that applies a preset configuration
 * Styled consistently with card patterns for unified hover/focus behavior
 */
export function PresetBadge({
  label,
  icon: Icon,
  onClick,
  active,
  disabled = false,
}: PresetBadgeProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${badge.preset} ${active ? badge.presetActive : badge.presetInactive} ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1`}
      aria-pressed={active}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}
