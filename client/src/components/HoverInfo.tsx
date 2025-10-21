import { Info } from 'lucide-react';
import { useState } from 'react';
import { hoverCard } from '../lib/design-tokens';

export interface HoverInfoProps {
  content: string;
  children?: React.ReactNode;
}

/**
 * Hover tooltip component - shows additional information on hover
 * Uses pure CSS (no Radix) for simplicity
 */
export function HoverInfo({ content, children }: HoverInfoProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        className={hoverCard.trigger}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onFocus={() => setIsVisible(true)}
        onBlur={() => setIsVisible(false)}
        aria-label="More information"
      >
        {children || <Info className="w-4 h-4" />}
      </button>
      {isVisible && (
        <div
          className={`${hoverCard.content} w-64 -translate-x-1/2 left-1/2 bottom-full mb-2`}
          role="tooltip"
        >
          {content}
        </div>
      )}
    </div>
  );
}
