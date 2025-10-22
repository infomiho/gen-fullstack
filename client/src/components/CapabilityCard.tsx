import type { LucideIcon } from 'lucide-react';
import { card } from '../lib/design-tokens';
import { Checkbox } from './Checkbox';
import { HoverInfo } from './HoverInfo';

/**
 * Interaction mode for the capability card
 * - interactive: Normal selectable card (default)
 * - readonly: Always selected, non-interactive, full opacity
 * - disabled: Temporarily disabled, faded appearance
 */
export type CapabilityCardMode = 'interactive' | 'readonly' | 'disabled';

export interface CapabilityCardProps {
  id: string;
  icon: LucideIcon;
  iconColor: string;
  title: string;
  description: string;
  hoverInfo: string;
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  mode?: CapabilityCardMode;
  children?: React.ReactNode;
}

/**
 * Determines appropriate card styling based on interaction mode
 *
 * Why separate function: Reduces cognitive complexity in main component
 * and makes mode-to-style mapping explicit and testable
 */
function getCardClassName(mode: CapabilityCardMode, checked: boolean): string {
  switch (mode) {
    case 'readonly':
      return `${card.base} ${checked ? card.active : ''}`;
    case 'disabled':
      return `${card.interactive} ${checked ? card.active : ''} ${card.disabled}`;
    case 'interactive':
      return `${card.interactive} ${checked ? card.active : ''}`;
  }
}

/**
 * Capability selection card with checkbox and optional nested controls
 *
 * Supports three modes:
 * - interactive: User can toggle (default)
 * - readonly: Always checked, prevents toggling (for required capabilities)
 * - disabled: Temporarily disabled (during generation)
 */
export function CapabilityCard({
  id,
  icon: Icon,
  iconColor,
  title,
  description,
  hoverInfo,
  checked,
  onCheckedChange,
  mode = 'interactive',
  children,
}: CapabilityCardProps) {
  const isInteractive = mode === 'interactive';

  const handleCardClick = (e: React.MouseEvent) => {
    if (!isInteractive || !onCheckedChange) return;

    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    // Don't toggle if clicking on the checkbox itself or nested controls
    if (target.closest('input[type="checkbox"]') || target.closest('.nested-controls')) {
      return;
    }

    onCheckedChange(!checked);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isInteractive || !onCheckedChange) return;

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onCheckedChange(!checked);
    }
  };

  return (
    <button
      type="button"
      className={getCardClassName(mode, checked)}
      onClick={handleCardClick}
      tabIndex={isInteractive ? 0 : -1}
      onKeyDown={handleKeyDown}
      aria-pressed={checked}
      aria-disabled={!isInteractive}
      disabled={!isInteractive}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 pt-0.5">
          <Checkbox
            id={id}
            checked={checked}
            onCheckedChange={onCheckedChange || (() => {})}
            mode={mode}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Icon className={`w-5 h-5 ${iconColor} flex-shrink-0`} />
            <span className="text-sm font-medium text-gray-900">{title}</span>
            <HoverInfo content={hoverInfo} />
          </div>
          <p className="text-sm text-gray-600">{description}</p>
          {checked && children && (
            <div className="nested-controls mt-3 pt-3 border-t border-gray-200">{children}</div>
          )}
        </div>
      </div>
    </button>
  );
}
