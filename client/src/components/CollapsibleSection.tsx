/**
 * CollapsibleSection Component
 *
 * A reusable collapsible section wrapper using Radix UI Collapsible.
 * Includes a chevron icon that rotates when the section is collapsed/expanded.
 */

import * as Collapsible from '@radix-ui/react-collapsible';
import { ChevronDown } from 'lucide-react';
import { typography } from '../lib/design-tokens';

export interface CollapsibleSectionProps {
  /** Section title */
  title: string;
  /** Section content */
  children: React.ReactNode;
  /** Whether the section is currently open */
  isOpen: boolean;
  /** Callback when the section is toggled */
  onToggle: () => void;
  /** Optional icon to display before the title */
  icon?: React.ReactNode;
  /** Optional aria-label for the trigger button */
  ariaLabel?: string;
}

export function CollapsibleSection({
  title,
  children,
  isOpen,
  onToggle,
  icon,
  ariaLabel,
}: CollapsibleSectionProps) {
  return (
    <Collapsible.Root open={isOpen} onOpenChange={onToggle}>
      <Collapsible.Trigger
        className="flex items-center gap-2 w-full group mb-3"
        aria-label={ariaLabel || `Toggle ${title} section`}
      >
        <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90" />
        <h3 className={`${typography.sectionHeader} flex items-center gap-2`}>
          {icon && <span>{icon}</span>}
          {title}
        </h3>
      </Collapsible.Trigger>
      <Collapsible.Content>{children}</Collapsible.Content>
    </Collapsible.Root>
  );
}
