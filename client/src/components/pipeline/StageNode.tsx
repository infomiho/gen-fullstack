/**
 * StageNode - Pipeline stage visualization component
 *
 * Displays a stage in the generation pipeline with:
 * - Stage label and description
 * - Status indicator (pending, started, completed, failed)
 * - Duration counter (when active)
 * - Tool list (Phase 3)
 *
 * Phase 1: Static rendering with pending status
 * Phase 2: Real-time status updates
 * Phase 3: Tool list display
 */

import { useState, useEffect } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import type { StageNodeData } from '../../lib/pipeline-builder';
import { stageStatus, typography, animations } from '../../lib/pipeline-tokens';

interface ExtendedStageNodeData extends StageNodeData {
  status?: 'pending' | 'started' | 'completed' | 'failed';
  startTimestamp?: number;
}

/**
 * Format duration in seconds to a readable string
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

export function StageNode(props: NodeProps) {
  const data = props.data as unknown as ExtendedStageNodeData;
  const status = data.status ?? 'pending';
  const statusStyle = stageStatus[status];

  // Live duration counter for "started" status
  const [duration, setDuration] = useState<number | null>(null);

  useEffect(() => {
    // Only show duration if status is "started" and we have a start timestamp
    if (status !== 'started' || !data.startTimestamp) {
      setDuration(null);
      return;
    }

    // Capture startTimestamp to avoid non-null assertion
    const startTimestamp = data.startTimestamp;

    // Update duration every second
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTimestamp;
      setDuration(elapsed);
    }, 1000);

    // Set initial duration immediately
    setDuration(Date.now() - startTimestamp);

    return () => clearInterval(interval);
  }, [status, data.startTimestamp]);

  return (
    <div className="relative">
      {/* Input handle */}
      <Handle type="target" position={Position.Left} className="!bg-border" />

      {/* Stage card */}
      <div
        className={`
          rounded-lg border-2 bg-card px-4 py-3
          ${statusStyle.bg} ${statusStyle.border}
          ${animations.colorTransition}
          ${status === 'started' && 'glow' in statusStyle ? statusStyle.glow : ''}
          w-[200px] min-h-[100px]
          flex flex-col gap-2
        `}
      >
        {/* Header: Status icon + Label */}
        <div className="flex items-center gap-2">
          <span className="text-base">{statusStyle.icon}</span>
          <h3 className={`${typography.stageLabel} ${statusStyle.text}`}>{data.label}</h3>
        </div>

        {/* Description */}
        {data.description && <p className="text-xs text-muted-foreground">{data.description}</p>}

        {/* Status text + Duration */}
        <div className="flex items-center justify-between">
          <div className={`${typography.stageStatus} ${statusStyle.text} capitalize`}>{status}</div>
          {duration !== null && (
            <div className={`${typography.stageDuration} ${statusStyle.text}`}>
              {formatDuration(duration)}
            </div>
          )}
        </div>
      </div>

      {/* Output handle */}
      <Handle type="source" position={Position.Right} className="!bg-border" />
    </div>
  );
}
