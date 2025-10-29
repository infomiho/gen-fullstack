import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { PipelineStageEvent } from '@gen-fullstack/shared';
import { focus, padding, radius, spacing, transitions, typography } from '../../lib/design-tokens';
import { formatTimestamp } from '../../lib/time-utils';
import {
  getStageName,
  getStageSummary,
  getDetailedStatusText,
  getDetailedStatusColor,
} from '../../lib/stage-utils';
import { StageIcon } from '../pipeline/StageIcon';
import { StageStatusIndicator } from '../pipeline/StageStatusIndicator';
import { StageContent } from '../pipeline/StageContent';

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
  const systemColor = 'bg-gray-100 dark:bg-gray-900/30 border-gray-300 dark:border-gray-800';

  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className={`w-full flex gap-3 ${radius.md} ${padding.card} ${systemColor} hover:border-border hover:bg-card ${transitions.colors} ${focus.ring} text-left`}
        >
          <div className="flex-shrink-0">
            <StageIcon type={stage.type} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <StageStatusIndicator status={stage.status} />
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
            <StageIcon type={stage.type} />
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
              <span className={`font-medium ${getDetailedStatusColor(stage.status)}`}>
                {getDetailedStatusText(stage.status)}
              </span>
            </div>

            <div>
              <h3 className={`${typography.label} mb-2`}>Details</h3>
              <StageContent
                stage={stage}
                isSectionExpanded={isSectionExpanded}
                onToggleSection={onToggleSection}
              />
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
