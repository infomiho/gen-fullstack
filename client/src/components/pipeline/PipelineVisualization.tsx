/**
 * PipelineVisualization - Main React Flow pipeline visualization
 *
 * Displays the generation pipeline as a horizontal flow diagram.
 * Dynamically generates nodes based on capability configuration.
 *
 * Phase 1: Static rendering based on config
 * Phase 2: Real-time status updates via WebSocket
 * Phase 3: Tool list display for active stage
 * Phase 5: Replay mode support
 */

import { useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type NodeTypes,
} from '@xyflow/react';
import type { CapabilityConfig, PipelineStageEvent } from '@gen-fullstack/shared';
import { buildPipelineNodes, type PipelineStageId } from '../../lib/pipeline-builder';
import { LabelNode } from './LabelNode';
import { StageNode } from './StageNode';
import { useGenerationStore } from '../../stores/generation';

// Import React Flow styles
import '@xyflow/react/dist/style.css';

export interface PipelineVisualizationProps {
  /** Capability configuration to determine pipeline structure */
  config: CapabilityConfig;
  /** Whether generation is currently active */
  isGenerating?: boolean;
  /** Replay mode flag (Phase 5) */
  isReplayMode?: boolean;
}

/**
 * Custom node types for the pipeline
 */
const nodeTypes: NodeTypes = {
  label: LabelNode,
  stage: StageNode,
};

/**
 * Determine the current status of a stage based on pipeline events
 */
function getStageStatus(
  stageId: PipelineStageId,
  pipelineStages: PipelineStageEvent[],
  isGenerating: boolean,
): 'pending' | 'started' | 'completed' | 'failed' {
  // Find all events for this stage type (may have multiple for validation iterations)
  const stageEvents = pipelineStages.filter((event) => event.type === stageId);

  if (stageEvents.length === 0) {
    // No events yet - check if this is code_generation and generation is active
    if (stageId === 'code_generation' && isGenerating) {
      // Infer that code generation has started if generation is active
      return 'started';
    }
    return 'pending';
  }

  // Get the most recent event for this stage
  const latestEvent = stageEvents[stageEvents.length - 1];
  return latestEvent.status;
}

export function PipelineVisualization({
  config,
  isGenerating = false,
}: PipelineVisualizationProps) {
  // Subscribe to pipeline stages from store
  const pipelineStages = useGenerationStore((state) => state.pipelineStages);

  // Build initial nodes and edges from config
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildPipelineNodes(config),
    [config],
  );

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  // Phase 2: Update node data when pipeline stages change
  useEffect(() => {
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        // Only update stage nodes, not label nodes
        if (node.type !== 'stage') return node;

        const stageId = (node.data as any).stageId as PipelineStageId;
        const status = getStageStatus(stageId, pipelineStages, isGenerating);

        // Find the latest event for this stage to get timestamp
        const stageEvents = pipelineStages.filter((event) => event.type === stageId);
        const latestEvent = stageEvents.length > 0 ? stageEvents[stageEvents.length - 1] : null;

        return {
          ...node,
          data: {
            ...node.data,
            status,
            startTimestamp: latestEvent?.status === 'started' ? latestEvent.timestamp : undefined,
          },
        };
      }),
    );
  }, [pipelineStages, isGenerating, setNodes]);

  // Fit view on mount
  const onInit = useCallback((reactFlowInstance: any) => {
    reactFlowInstance.fitView({ padding: 0.2 });
  }, []);

  return (
    <div className="h-full w-full bg-muted/30">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onInit={onInit}
        fitView
        minZoom={0.5}
        maxZoom={1.5}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: false,
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
        <MiniMap
          nodeStrokeWidth={3}
          zoomable
          pannable
          className="!bg-card !border !border-border"
        />
      </ReactFlow>
    </div>
  );
}
