import type { PipelineStageEvent } from '@gen-fullstack/shared';
import { typography } from '../../lib/design-tokens';
import { getStatusColor, getStatusIndicator, getStatusLabel } from '../../lib/stage-utils';

export interface StageStatusIndicatorProps {
  /** The stage status to display */
  status: PipelineStageEvent['status'];
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays a stage status indicator with appropriate color and accessibility label
 *
 * Shows: ● (completed), ✕ (failed), ○ (started)
 */
export function StageStatusIndicator({ status, className }: StageStatusIndicatorProps) {
  return (
    <output
      className={`${typography.caption} ${getStatusColor(status)} ${className || ''}`}
      aria-label={getStatusLabel(status)}
    >
      {getStatusIndicator(status)}
    </output>
  );
}
