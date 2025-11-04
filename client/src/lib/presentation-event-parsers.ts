import type { PipelineStageEvent, ToolCall } from '@gen-fullstack/shared';
import type { PresentationEvent } from '../stores/presentationStore';
import { presentationTokens } from './presentation-tokens';

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
 * Normalize file path for consistent comparison
 * Removes leading './', normalizes slashes, collapses redundant segments
 */
function normalizePath(path: string): string {
  return path
    .replace(/^\.\//, '') // Remove leading './'
    .replace(/\\/g, '/') // Normalize backslashes to forward slashes
    .replace(/\/\.\//g, '/') // Remove redundant './''
    .replace(/\/+/g, '/'); // Collapse multiple slashes
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
 * Note: Due to database UPSERT behavior, 'started' events are overwritten by 'completed',
 * so we create the overlay from 'completed' status for replay mode.
 */
export function parseTemplateLoadingStage(stage: PipelineStageEvent): PresentationEvent | null {
  if (stage.status === 'started' || stage.status === 'completed') {
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
 * Parse code generation stage event
 * Note: Due to database UPSERT behavior, 'started' events are overwritten by 'completed',
 * so we create the overlay from 'completed' status for replay mode.
 */
export function parseCodeGenerationStage(stage: PipelineStageEvent): PresentationEvent | null {
  if (stage.status === 'started' || stage.status === 'completed') {
    return {
      type: 'code-generation',
      duration: 2000, // 2 seconds
    };
  }
  return null;
}

/**
 * Parse validation stage event
 * Note: Returns array to support both loading and result overlays.
 * Due to database UPSERT, we create both from 'completed' status for replay mode.
 */
export function parseValidationStage(stage: PipelineStageEvent): PresentationEvent[] {
  const events: PresentationEvent[] = [];

  if (stage.status === 'started') {
    // Live mode: just show loading
    const isPrisma = stage.data?.validationErrors?.some((e) => e.type === 'prisma') ?? false;
    events.push({
      type: isPrisma ? 'validation-prisma' : 'validation-typescript',
      duration: 2000,
    });
  } else if (stage.status === 'completed' || stage.status === 'failed') {
    // Replay mode: show both loading AND result (since 'started' was overwritten)
    const errorCount = stage.data?.validationErrors?.length || 0;
    const passed = errorCount === 0;
    const iteration = stage.data?.iteration;

    // Determine validation type from errors
    const isPrisma = stage.data?.validationErrors?.some((e) => e.type === 'prisma') ?? false;

    // Add loading overlay first
    events.push({
      type: isPrisma ? 'validation-prisma' : 'validation-typescript',
      duration: 2000,
    });

    // Then add result overlay
    events.push({
      type: 'validation-result',
      duration: passed ? 2000 : 2500,
      data: {
        validationResult: { passed, errorCount, iteration },
      },
    });
  }

  return events;
}

/**
 * Parse error fixing stage event
 * Note: Due to database UPSERT behavior, 'started' events are overwritten by 'completed',
 * so we create the overlay from 'completed' status for replay mode.
 */
export function parseErrorFixingStage(stage: PipelineStageEvent): PresentationEvent | null {
  if (stage.status === 'started' || stage.status === 'completed') {
    const iteration = stage.data?.iteration;
    const errorCount = stage.data?.errorCount || stage.data?.validationErrors?.length;

    return {
      type: 'error-fixing',
      duration: 3000,
      data: { iteration, errorCount },
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
 * @param currentFileWriteCount - Current count of unique file creates (for combo milestones)
 * @param seenFiles - Set of file paths already written (to distinguish created vs modified)
 * @returns Array of events (file-created, and optionally combo-milestone)
 */
export function parseWriteFileTool(
  toolCall: ToolCall,
  currentFileWriteCount: number,
  seenFiles: Set<string>,
): PresentationEvent[] {
  const events: PresentationEvent[] = [];
  const filePath = extractFileFromToolCall(toolCall);
  const normalizedPath = filePath ? normalizePath(filePath) : undefined;

  // Skip if file was already written (modification, not creation)
  if (normalizedPath && seenFiles.has(normalizedPath)) {
    return events; // Empty array - no overlay for modifications
  }

  // Mark file as seen
  if (normalizedPath) {
    seenFiles.add(normalizedPath);
  }

  const fileCount = currentFileWriteCount + 1;

  events.push({
    type: 'file-created',
    duration:
      currentFileWriteCount === 0
        ? presentationTokens.timing.fileCreatedFirstDelay
        : presentationTokens.timing.fileCreatedDelay,
    data: { fileName: filePath || `file-${fileCount}` },
  });

  // Show combo milestone right after milestone files (10, 20, 30, etc.)
  if (fileCount === 10 || (fileCount >= 20 && fileCount % 10 === 0)) {
    events.push({
      type: 'combo-milestone',
      duration: 2000,
      data: { comboMilestone: fileCount },
    });
  }

  return events;
}
