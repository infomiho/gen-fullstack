import * as Dialog from '@radix-ui/react-dialog';
import { CheckCircle, AlertTriangle, Package, Layers, X } from 'lucide-react';
import type { PipelineStageEvent } from '@gen-fullstack/shared';
import { focus, padding, radius, spacing, transitions, typography } from '../../lib/design-tokens';
import { formatTimestamp } from '../../lib/time-utils';
import { PlanArchitectureDisplay } from '../PlanArchitectureDisplay';
import { ValidationErrorsDisplay } from '../ValidationErrorsDisplay';

export interface PipelineStageItemProps {
  /** The pipeline stage to display */
  stage: PipelineStageEvent;
  /** Whether the stage dialog is open */
  isOpen: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Check if a section is expanded (optional, for state persistence) */
  isSectionExpanded?: (id: string, section: string) => boolean;
  /** Toggle a section's expanded state (optional, for state persistence) */
  onToggleSection?: (id: string, section: string) => void;
}

/**
 * Get stage icon and color based on stage type
 */
function getStageIcon(type: PipelineStageEvent['type']) {
  switch (type) {
    case 'planning':
      return { icon: Layers, color: 'text-amber-500' };
    case 'validation':
      return { icon: AlertTriangle, color: 'text-purple-500' };
    case 'template_loading':
      return { icon: Package, color: 'text-blue-500' };
    case 'completing':
      return { icon: CheckCircle, color: 'text-green-500' };
  }
}

/**
 * Get stage display name
 */
function getStageName(type: PipelineStageEvent['type']): string {
  switch (type) {
    case 'planning':
      return 'Planning Architecture';
    case 'validation':
      return 'Validation';
    case 'template_loading':
      return 'Template Loading';
    case 'completing':
      return 'Completing';
  }
}

/**
 * Get stage summary for timeline card
 */
function getStageSummary(stage: PipelineStageEvent): string {
  if (stage.status === 'failed') {
    return `Failed`;
  }

  switch (stage.type) {
    case 'planning': {
      if (stage.data?.plan) {
        const { databaseModels = [], apiRoutes = [], clientComponents = [] } = stage.data.plan;
        return `${databaseModels.length} models, ${apiRoutes.length} routes, ${clientComponents.length} components`;
      }
      return 'Generating architectural plan...';
    }
    case 'validation': {
      if (stage.data?.validationErrors) {
        const errorCount = stage.data.validationErrors.length;
        if (errorCount === 0) {
          return '✓ No errors found';
        }
        const iteration = stage.data.iteration;
        const suffix = iteration ? ` (Retry ${iteration}/${stage.data.maxIterations ?? 3})` : '';
        return `⚠️ Found ${errorCount} error${errorCount === 1 ? '' : 's'}${suffix}`;
      }
      return 'Running Prisma + TypeScript checks...';
    }
    case 'template_loading': {
      return stage.data?.templateName ? `Copied ${stage.data.templateName}` : 'Loading template...';
    }
    case 'completing': {
      return stage.data?.summary || 'Finalizing generation...';
    }
  }
}

/**
 * Render modal content based on stage type
 */
function renderStageContent(
  stage: PipelineStageEvent,
  isSectionExpanded?: (id: string, section: string) => boolean,
  onToggleSection?: (id: string, section: string) => void,
) {
  switch (stage.type) {
    case 'planning': {
      if (stage.data?.plan) {
        return (
          <PlanArchitectureDisplay
            {...stage.data.plan}
            toolId={stage.id}
            isSectionExpanded={isSectionExpanded}
            onToggleSection={onToggleSection}
          />
        );
      }
      return (
        <div className={`${typography.body} text-muted-foreground`}>No plan data available</div>
      );
    }

    case 'validation': {
      if (stage.data?.validationErrors) {
        return (
          <ValidationErrorsDisplay
            errors={stage.data.validationErrors}
            stageId={stage.id}
            isSectionExpanded={isSectionExpanded}
            onToggleSection={onToggleSection}
          />
        );
      }
      return (
        <div className={`${typography.body} text-muted-foreground`}>
          No validation results available
        </div>
      );
    }

    case 'template_loading': {
      return (
        <div className={`${typography.body}`}>
          <div className="mb-2">
            <span className="text-muted-foreground">Template: </span>
            <span className={`${typography.mono} text-foreground`}>
              {stage.data?.templateName || 'Unknown'}
            </span>
          </div>
          <div className="text-muted-foreground text-sm">
            Template files have been copied to the sandbox and are ready for code generation.
          </div>
        </div>
      );
    }

    case 'completing': {
      return (
        <div className={`${typography.body}`}>
          {stage.data?.summary ? (
            <div className="text-foreground">{stage.data.summary}</div>
          ) : (
            <div className="text-muted-foreground">Generation completed successfully.</div>
          )}
        </div>
      );
    }
  }
}

/**
 * PipelineStageItem component - displays a pipeline stage in the timeline
 *
 * Shows stage name, status, and summary. Clicking opens a dialog with
 * stage-specific details (plan, errors, etc.).
 */
export function PipelineStageItem({
  stage,
  isOpen,
  onOpenChange,
  isSectionExpanded,
  onToggleSection,
}: PipelineStageItemProps) {
  const { icon: StageIcon, color: iconColor } = getStageIcon(stage.type);
  const systemColor = 'bg-gray-100 dark:bg-gray-900/30 border-gray-300 dark:border-gray-800';

  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className={`w-full flex gap-3 ${radius.md} ${padding.card} ${systemColor} hover:border-border hover:bg-card ${transitions.colors} ${focus.ring} text-left`}
        >
          <div className="flex-shrink-0">
            <StageIcon size={20} className={iconColor} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`${typography.caption} ${
                  stage.status === 'completed'
                    ? 'text-green-600'
                    : stage.status === 'failed'
                      ? 'text-red-600'
                      : 'text-gray-500'
                }`}
              >
                {stage.status === 'completed' ? '●' : stage.status === 'failed' ? '✕' : '○'}
              </span>
              <span className={`${typography.label} text-foreground`}>SYSTEM</span>
              <span className={`${typography.mono} text-foreground font-medium`}>
                {getStageName(stage.type)}
              </span>
              <span className={`${typography.monoSm} text-muted-foreground ml-auto`}>
                {formatTimestamp(stage.timestamp)}
              </span>
              {stage.status === 'started' && (
                <span className={`${typography.caption} text-muted-foreground`}>running...</span>
              )}
            </div>
            <div className={`${typography.caption} text-muted-foreground truncate`}>
              {getStageSummary(stage)}
            </div>
          </div>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={`fixed left-1/2 top-1/2 z-50 w-full max-w-2xl max-h-[85vh] -translate-x-1/2 -translate-y-1/2 ${radius.md} border bg-card ${padding.panel} shadow-lg overflow-y-auto data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]`}
        >
          <Dialog.Title className={`${typography.label} text-lg mb-4 flex items-center gap-2`}>
            <StageIcon size={20} className={iconColor} />
            <span className={typography.mono}>{getStageName(stage.type)}</span>
            <span className="ml-2 px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs rounded">
              SYSTEM
            </span>
          </Dialog.Title>

          <Dialog.Close
            className={`absolute right-4 top-4 ${radius.sm} p-1.5 hover:bg-muted ${transitions.colors} ${focus.ring}`}
          >
            <X size={16} />
            <span className="sr-only">Close</span>
          </Dialog.Close>

          <Dialog.Description className="sr-only">
            Details of the {getStageName(stage.type)} stage
          </Dialog.Description>

          <div className={spacing.controls}>
            <div className={`flex items-center gap-2 ${typography.body}`}>
              <span className="text-muted-foreground">Status:</span>
              <span
                className={`font-medium ${
                  stage.status === 'failed'
                    ? 'text-red-700 dark:text-red-400'
                    : stage.status === 'completed'
                      ? 'text-green-700 dark:text-green-400'
                      : 'text-yellow-700 dark:text-yellow-400'
                }`}
              >
                {stage.status === 'failed'
                  ? 'Failed'
                  : stage.status === 'completed'
                    ? 'Complete'
                    : 'Running'}
              </span>
            </div>

            <div>
              <h3 className={`${typography.label} mb-2`}>Details</h3>
              {renderStageContent(stage, isSectionExpanded, onToggleSection)}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
