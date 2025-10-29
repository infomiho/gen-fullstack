import type { PipelineStageEvent } from '@gen-fullstack/shared';
import { getStageIcon } from '../../lib/stage-utils';

export interface StageIconProps {
  /** The stage type to display icon for */
  type: PipelineStageEvent['type'];
  /** Icon size in pixels */
  size?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Displays a stage icon with appropriate color based on stage type
 */
export function StageIcon({ type, size = 20, className }: StageIconProps) {
  const { icon: Icon, color } = getStageIcon(type);

  return <Icon size={size} className={`${color} ${className || ''}`} />;
}
