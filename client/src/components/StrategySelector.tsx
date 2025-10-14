import { useId } from 'react';

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
    <div className="space-y-2">
      <label htmlFor={selectId} className="text-sm font-medium text-gray-700">
        Generation Strategy
      </label>
      <select
        id={selectId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
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
