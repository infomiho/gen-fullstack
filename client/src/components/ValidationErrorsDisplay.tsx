/**
 * Validation Errors Display Component
 *
 * Renders a structured, collapsible view of validation errors from compiler checks
 * (Prisma schema errors and TypeScript errors).
 */

import * as Collapsible from '@radix-ui/react-collapsible';
import { ChevronDown } from 'lucide-react';
import type { ValidationError } from '@gen-fullstack/shared';
import { radius, spacing, typography } from '../lib/design-tokens';

export interface ValidationErrorsDisplayProps {
  errors: ValidationError[];
  /** Stage ID for state management (optional, enables controlled mode) */
  stageId?: string;
  /** Check if a section is expanded (optional, for controlled mode) */
  isSectionExpanded?: (stageId: string, section: string) => boolean;
  /** Toggle a section's expanded state (optional, for controlled mode) */
  onToggleSection?: (stageId: string, section: string) => void;
}

export function ValidationErrorsDisplay({
  errors,
  stageId,
  isSectionExpanded,
  onToggleSection,
}: ValidationErrorsDisplayProps) {
  /**
   * Get collapsible state props - either controlled or uncontrolled
   */
  const getSectionState = (section: string) => {
    if (stageId && isSectionExpanded && onToggleSection) {
      // CONTROLLED mode (used in Timeline modal for state persistence)
      return {
        open: isSectionExpanded(stageId, section),
        onOpenChange: () => onToggleSection(stageId, section),
      };
    }
    // UNCONTROLLED mode (fallback for Storybook, tests, etc.)
    return { defaultOpen: true };
  };

  // Group errors by type
  const prismaErrors = errors.filter((e) => e.type === 'prisma');
  const typescriptErrors = errors.filter((e) => e.type === 'typescript');

  // Empty state
  if (errors.length === 0) {
    return <div className={`${typography.body} text-green-600`}>✓ No validation errors found</div>;
  }

  // Helper to render error type badge
  const renderTypeBadge = (type: 'prisma' | 'typescript') => {
    const colors = {
      prisma: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      typescript: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    };
    const labels = {
      prisma: 'Prisma',
      typescript: 'TypeScript',
    };
    return (
      <span
        className={`inline-block px-2 py-0.5 ${radius.sm} border ${typography.mono} text-xs font-medium ${colors[type]}`}
      >
        {labels[type]}
      </span>
    );
  };

  // Helper to format file path with line/column
  const formatLocation = (error: ValidationError) => {
    const parts = [error.file];
    if (error.line !== undefined) {
      parts.push(`:${error.line}`);
      if (error.column !== undefined) {
        parts.push(`:${error.column}`);
      }
    }
    return parts.join('');
  };

  return (
    <div className={`${typography.body} ${spacing.form}`}>
      {/* Prisma Errors Section */}
      {prismaErrors.length > 0 && (
        <Collapsible.Root {...getSectionState('prismaErrors')} className="mb-4">
          <Collapsible.Trigger
            className="flex items-center gap-2 w-full group"
            aria-label={`Toggle Prisma errors section (${prismaErrors.length} errors)`}
          >
            <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90" />
            <div className={`${typography.label} text-foreground`}>
              ⚠️ Prisma Errors ({prismaErrors.length})
            </div>
          </Collapsible.Trigger>
          <Collapsible.Content className="mt-2">
            <div className={`${spacing.list} border-l-2 border-red-500/30 pl-4`}>
              {prismaErrors.map((error, index) => (
                <div
                  key={`prisma-${error.file}-${error.line || 0}-${index}`}
                  className="mb-3 last:mb-0"
                >
                  <div className="flex items-center gap-2 mb-1">
                    {renderTypeBadge('prisma')}
                    <div className={`${typography.mono} text-xs text-muted-foreground`}>
                      {formatLocation(error)}
                    </div>
                  </div>
                  <div className="text-red-600 text-sm bg-red-500/5 p-2 rounded border border-red-500/20">
                    {error.message}
                  </div>
                </div>
              ))}
            </div>
          </Collapsible.Content>
        </Collapsible.Root>
      )}

      {/* TypeScript Errors Section */}
      {typescriptErrors.length > 0 && (
        <Collapsible.Root {...getSectionState('typescriptErrors')}>
          <Collapsible.Trigger
            className="flex items-center gap-2 w-full group"
            aria-label={`Toggle TypeScript errors section (${typescriptErrors.length} errors)`}
          >
            <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90" />
            <div className={`${typography.label} text-foreground`}>
              ⚠️ TypeScript Errors ({typescriptErrors.length})
            </div>
          </Collapsible.Trigger>
          <Collapsible.Content className="mt-2">
            <div className={`${spacing.list} border-l-2 border-red-500/30 pl-4`}>
              {typescriptErrors.map((error, index) => (
                <div
                  key={`typescript-${error.file}-${error.line || 0}-${index}`}
                  className="mb-3 last:mb-0"
                >
                  <div className="flex items-center gap-2 mb-1">
                    {renderTypeBadge('typescript')}
                    {error.code && (
                      <span className={`${typography.mono} text-xs text-muted-foreground`}>
                        {error.code}
                      </span>
                    )}
                    <div className={`${typography.mono} text-xs text-muted-foreground`}>
                      {formatLocation(error)}
                    </div>
                  </div>
                  <div className="text-red-600 text-sm bg-red-500/5 p-2 rounded border border-red-500/20">
                    {error.message}
                  </div>
                </div>
              ))}
            </div>
          </Collapsible.Content>
        </Collapsible.Root>
      )}
    </div>
  );
}
