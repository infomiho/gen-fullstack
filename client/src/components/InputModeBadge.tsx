import { Code2, FileCode } from 'lucide-react';
import type { InputMode } from '@gen-fullstack/shared';

interface InputModeBadgeProps {
  inputMode: InputMode;
}

/**
 * InputModeBadge component
 *
 * Displays a badge for the input mode (Naive or Template)
 * with appropriate icon and color coding.
 */
export function InputModeBadge({ inputMode }: InputModeBadgeProps) {
  const isNaive = inputMode === 'naive';

  const Icon = isNaive ? Code2 : FileCode;
  const label = isNaive ? 'Naive' : 'Template';
  const colorClasses = isNaive
    ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
    : 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${colorClasses}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}
