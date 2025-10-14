import { useId } from 'react';
import { focus, input, spacing, typography } from '../lib/design-tokens';

interface StrategySelectorProps {
  value: string;
  onChange: (strategy: string) => void;
  disabled?: boolean;
}

const strategies = [
  { value: 'naive', label: 'Naive Approach', description: 'Direct prompt to code' },
  {
    value: 'plan-first',
    label: 'Plan First',
    description: 'Generate high-level plan before coding',
  },
  {
    value: 'template',
    label: 'With Template',
    description: 'Start with pre-built template',
  },
  {
    value: 'compiler-check',
    label: 'Compiler Checks',
    description: 'Self-correct with TypeScript errors',
  },
  {
    value: 'building-blocks',
    label: 'Building Blocks',
    description: 'Use higher-level components',
  },
];

export function StrategySelector({ value, onChange, disabled }: StrategySelectorProps) {
  const selectId = useId();

  return (
    <div className={spacing.form}>
      <label htmlFor={selectId} className={typography.label}>
        Generation Strategy
      </label>
      <select
        id={selectId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`${input.select} ${focus.ring}`}
      >
        {strategies.map((strategy) => (
          <option key={strategy.value} value={strategy.value}>
            {strategy.label} - {strategy.description}
          </option>
        ))}
      </select>
    </div>
  );
}
