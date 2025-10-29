import type { PipelineStageEvent, ToolCall } from '@gen-fullstack/shared';
import type { PresentationEvent } from '../stores/presentationStore';

/**
 * Type guards and interfaces for tool call arguments
 */
interface RequestBlockArgs {
  blockName?: string;
  blockId?: string;
}

interface WriteFileArgs {
  path?: string;
  file_path?: string;
  fileName?: string;
}

function safeParse<T>(json: string | unknown): T | null {
  try {
    return typeof json === 'string' ? (JSON.parse(json) as T) : (json as T);
  } catch {
    return null;
  }
}

/**
 * Extract file path from tool call arguments
 */
export function extractFileFromToolCall(toolCall: ToolCall): string | undefined {
  if (!toolCall.args) return undefined;

  const args = safeParse<WriteFileArgs>(toolCall.args);
  return args?.path || args?.file_path || args?.fileName;
}

/**
 * Parse template loading stage event
 */
export function parseTemplateLoadingStage(stage: PipelineStageEvent): PresentationEvent | null {
  if (stage.status === 'started') {
    return {
      type: 'template-loading',
      duration: 3000, // 3 seconds
    };
  }
  return null;
}

/**
 * Parse planning stage event
 */
export function parsePlanningStage(stage: PipelineStageEvent): PresentationEvent[] {
  const events: PresentationEvent[] = [];

  if (stage.status === 'completed' && stage.data?.plan) {
    const plan = stage.data.plan;

    // Emit model events
    (plan.databaseModels || []).forEach((model) => {
      events.push({
        type: 'planning',
        duration: 400,
        data: { planItem: { type: 'model', name: model.name } },
      });
    });

    // Emit endpoint events (apiRoutes in the plan)
    (plan.apiRoutes || []).forEach((route) => {
      const name = route.method && route.path ? `${route.method} ${route.path}` : route.path;
      events.push({
        type: 'planning',
        duration: 400,
        data: { planItem: { type: 'endpoint', name } },
      });
    });

    // Emit component events
    (plan.clientComponents || []).forEach((component) => {
      events.push({
        type: 'planning',
        duration: 400,
        data: { planItem: { type: 'component', name: component.name } },
      });
    });
  }

  return events;
}

/**
 * Parse validation stage event
 */
export function parseValidationStage(stage: PipelineStageEvent): PresentationEvent | null {
  if (stage.status === 'started') {
    // Determine validation type from errors (if prisma errors, it's prisma validation)
    const isPrisma = stage.data?.validationErrors?.some((e) => e.type === 'prisma') ?? false;
    return {
      type: isPrisma ? 'validation-prisma' : 'validation-typescript',
      duration: 3000,
    };
  }

  if (stage.status === 'completed' || stage.status === 'failed') {
    const passed = stage.status === 'completed';
    const errorCount = stage.data?.validationErrors?.length || 0;
    const iteration = stage.data?.iteration;

    return {
      type: 'validation-result',
      duration: passed ? 2000 : 3000,
      data: {
        validationResult: { passed, errorCount, iteration },
      },
    };
  }

  return null;
}

/**
 * Parse requestBlock tool call
 */
export function parseBlockRequestTool(toolCall: ToolCall): PresentationEvent | null {
  const args = safeParse<RequestBlockArgs>(toolCall.args);
  if (!args) return null;

  const blockName = args.blockName || args.blockId || 'Building Block';
  return {
    type: 'block-request',
    duration: 3000,
    data: { blockName },
  };
}

/**
 * Parse writeFile tool call
 *
 * @param toolCall - The tool call to parse
 * @param currentFileWriteCount - Current count of file writes (for combo milestones)
 * @returns Array of events (file-created, and optionally combo-milestone)
 */
export function parseWriteFileTool(
  toolCall: ToolCall,
  currentFileWriteCount: number,
): PresentationEvent[] {
  const events: PresentationEvent[] = [];
  const fileCount = currentFileWriteCount + 1;

  const fileName = extractFileFromToolCall(toolCall);
  events.push({
    type: 'file-created',
    duration: 500,
    data: { fileName: fileName || `file-${fileCount}` },
  });

  // Show combo milestone right after milestone files (5, 10, 20, 30, etc.)
  if (fileCount === 5 || fileCount === 10 || (fileCount >= 20 && fileCount % 10 === 0)) {
    events.push({
      type: 'combo-milestone',
      duration: 2000,
      data: { comboMilestone: fileCount },
    });
  }

  return events;
}
