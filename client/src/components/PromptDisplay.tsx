import { typography } from '../lib/design-tokens';
import { CopyButton } from './CopyButton';

interface PromptDisplayProps {
  /** The prompt text to display */
  prompt: string;
  /** Optional className for custom styling */
  className?: string;
}

/**
 * PromptDisplay component
 *
 * Displays a prompt in a styled container with gray background and a copy button.
 * Used consistently across session cards and session sidebar.
 *
 * @example
 * ```tsx
 * <PromptDisplay prompt="Build a todo app" />
 * ```
 */
export function PromptDisplay({ prompt, className = '' }: PromptDisplayProps) {
  return (
    <div className={`relative p-3 bg-gray-50 border border-gray-200 rounded ${className}`}>
      <p className={`${typography.body} text-gray-700 leading-relaxed pr-6 whitespace-pre-wrap`}>
        {prompt}
      </p>
      <div className="absolute top-2 right-2">
        <CopyButton text={prompt} title="Copy prompt" iconSize={14} />
      </div>
    </div>
  );
}
