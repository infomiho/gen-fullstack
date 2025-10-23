import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { focus, transitions } from '../lib/design-tokens';

interface CopyButtonProps {
  /** Text to copy to clipboard */
  text: string;
  /** Optional title for the button (default: "Copy") */
  title?: string;
  /** Size of the icon (default: 14) */
  iconSize?: number;
  /** Optional className for custom styling */
  className?: string;
}

/**
 * CopyButton component
 *
 * A reusable button that copies text to clipboard with visual feedback.
 * Shows a checkmark for 2 seconds after successful copy.
 *
 * @example
 * ```tsx
 * <CopyButton text="Hello world" />
 * <CopyButton text="Code snippet" title="Copy code" iconSize={16} />
 * ```
 */
export function CopyButton({
  text,
  title = 'Copy',
  iconSize = 14,
  className = '',
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: Useful for debugging copy failures
      console.error('Failed to copy text:', error);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`flex-shrink-0 p-1.5 rounded ${transitions.colors} hover:bg-gray-100 ${focus.ring} ${className}`}
      title={copied ? 'Copied!' : title}
    >
      {copied ? (
        <Check size={iconSize} className="text-green-600" />
      ) : (
        <Copy size={iconSize} className="text-gray-400" />
      )}
    </button>
  );
}
