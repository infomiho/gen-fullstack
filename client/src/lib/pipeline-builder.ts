/**
 * Pipeline Builder
 *
 * Generates React Flow nodes and edges from CapabilityConfig.
 * Provides the configuration-driven pipeline visualization logic.
 */

import type { Node, Edge } from '@xyflow/react';
import type { CapabilityConfig } from '@gen-fullstack/shared';
import { layout } from './pipeline-tokens';

/**
 * Pipeline stage type - maps to the stages we want to visualize
 */
export type PipelineStageId =
  | 'prompt'
  | 'template_loading'
  | 'planning'
  | 'code_generation'
  | 'validation'
  | 'completing'
  | 'app';

/**
 * Stage node data
 */
export interface StageNodeData {
  label: string;
  stageId: PipelineStageId;
  description?: string;
}

/**
 * Label node data (for Prompt and App endpoints)
 */
export interface LabelNodeData {
  label: string;
}

/**
 * Build pipeline nodes and edges from capability configuration
 *
 * Creates a horizontal flow: Prompt → [Template] → [Planning] → Code Gen → [Validation] → Completing → App
 *
 * @param config - Capability configuration
 * @returns Object with nodes and edges arrays for React Flow
 */
export function buildPipelineNodes(config: CapabilityConfig): {
  nodes: Node[];
  edges: Edge[];
} {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  let xPosition = 0;
  let previousNodeId: string | null = null;

  // Helper: Add a label node (simple text, no border)
  function addLabelNode(id: string, label: string) {
    nodes.push({
      id,
      type: 'label',
      position: { x: xPosition, y: layout.verticalCenter },
      data: { label } satisfies LabelNodeData,
    });

    // Connect to previous node
    if (previousNodeId) {
      edges.push({
        id: `${previousNodeId}-${id}`,
        source: previousNodeId,
        target: id,
        type: 'smoothstep',
        animated: false,
      });
    }

    previousNodeId = id;
    xPosition += layout.horizontalSpacing;
  }

  // Helper: Add a stage node (bordered box with status)
  function addStageNode(id: PipelineStageId, label: string, description?: string) {
    nodes.push({
      id,
      type: 'stage',
      position: { x: xPosition, y: layout.verticalCenter - layout.nodeHeight / 2 },
      data: { label, stageId: id, description } satisfies StageNodeData,
    });

    // Connect to previous node
    if (previousNodeId) {
      edges.push({
        id: `${previousNodeId}-${id}`,
        source: previousNodeId,
        target: id,
        type: 'smoothstep',
        animated: false,
      });
    }

    previousNodeId = id;
    xPosition += layout.nodeWidth + layout.horizontalSpacing;
  }

  // 1. Start with "Prompt" label
  addLabelNode('prompt', 'Prompt');

  // 2. Add "Template" stage if using template input mode
  if (config.inputMode === 'template') {
    addStageNode('template_loading', 'Template', 'Load pre-built template');
  }

  // 3. Add "Planning" stage if planning is enabled
  if (config.planning) {
    addStageNode('planning', 'Planning', 'Generate architecture plan');
  }

  // 4. Always add "Code Generation" stage (inferred from LLM activity)
  addStageNode('code_generation', 'Code Generation', 'Write application code');

  // 5. Add "Validation" stage if compiler checks are enabled
  if (config.compilerChecks) {
    addStageNode('validation', 'Validation', 'TypeScript & Prisma checks');
  }

  // 6. Always add "Completing" stage
  addStageNode('completing', 'Completing', 'Finalize generation');

  // 7. End with "App" label
  addLabelNode('app', 'App');

  return { nodes, edges };
}
