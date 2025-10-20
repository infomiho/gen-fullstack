import { useId } from 'react';
import { IMPLEMENTED_STRATEGIES, type ImplementedStrategyType } from '@gen-fullstack/shared';
import { focus, input, spacing, typography } from '../lib/design-tokens';

interface StrategySelectorProps {
  value: ImplementedStrategyType;
  onChange: (strategy: ImplementedStrategyType) => void;
  disabled?: boolean;
  id?: string;
  label?: string;
}

export function StrategySelector({ value, onChange, disabled, id, label }: StrategySelectorProps) {
  const generatedId = useId();
  const selectId = id || generatedId;

  return (
    <div className={spacing.form}>
      {label && (
        <label htmlFor={selectId} className={typography.label}>
          {label}
        </label>
      )}
      <select
        id={selectId}
        value={value}
        onChange={(e) => onChange(e.target.value as ImplementedStrategyType)}
        disabled={disabled}
        className={`${input.select} ${focus.ring}`}
      >
        {IMPLEMENTED_STRATEGIES.map((strategy) => (
          <option key={strategy.value} value={strategy.value}>
            {strategy.label} - {strategy.description}
          </option>
        ))}
      </select>
    </div>
  );
}
