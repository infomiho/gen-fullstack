/**
 * LabelNode - Simple text node for pipeline endpoints
 *
 * Used for "Prompt" and "App" labels at the start and end of the pipeline.
 * No border, just text - minimal visual weight.
 */

import type { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import type { LabelNodeData } from '../../lib/pipeline-builder';

export function LabelNode(props: NodeProps) {
  const data = props.data as unknown as LabelNodeData;

  return (
    <div className="flex items-center justify-center">
      {/* Input handle (except for Prompt) */}
      {data.label !== 'Prompt' && (
        <Handle type="target" position={Position.Left} className="!bg-border" />
      )}

      {/* Label text */}
      <div className="px-3 py-2 text-sm font-semibold text-foreground">{data.label}</div>

      {/* Output handle (except for App) */}
      {data.label !== 'App' && (
        <Handle type="source" position={Position.Right} className="!bg-border" />
      )}
    </div>
  );
}
