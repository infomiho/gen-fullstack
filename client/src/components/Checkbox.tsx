import { Check } from 'lucide-react';
import { checkbox } from '../lib/design-tokens';

/**
 * Checkbox mode matching CapabilityCard mode
 * - interactive: Normal selectable checkbox (default)
 * - readonly: Always checked, non-interactive, full opacity
 * - disabled: Temporarily disabled, faded appearance
 */
export type CheckboxMode = 'interactive' | 'readonly' | 'disabled';

export interface CheckboxProps {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  mode?: CheckboxMode;
  'aria-label'?: string;
}

/**
 * Custom styled checkbox with mode-based interaction states
 *
 * Uses aria-readonly for readonly mode to properly communicate
 * non-interactive state to screen readers without visual disability styling
 */
export function Checkbox({
  id,
  checked,
  onCheckedChange,
  mode = 'interactive',
  'aria-label': ariaLabel,
}: CheckboxProps) {
  const isReadOnly = mode === 'readonly';
  const isDisabled = mode === 'disabled';

  return (
    <div className={checkbox.wrapper}>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
        disabled={isDisabled}
        aria-readonly={isReadOnly}
        className={isReadOnly ? checkbox.inputReadOnly : checkbox.input}
        aria-label={ariaLabel}
      />
      <Check className={checkbox.icon} strokeWidth={3} />
    </div>
  );
}
