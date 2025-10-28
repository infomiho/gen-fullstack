import type { LLMMessage, ToolCall, PipelineStageEvent } from '@gen-fullstack/shared';
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
 * Build presentation event queue from session timeline
 *
 * Parses ALL events upfront to create a showcase-ready sequence
 * Independent of replay timing - events are shown at presentation pace
 *
 * Uses pipeline stages as the authoritative source for stage events (planning, validation, template loading)
 *
 * @param messages - All LLM messages from timeline
 * @param toolCalls - All tool calls from timeline
 * @param pipelineStages - All pipeline stage events from timeline
 * @param sessionDurationMs - Optional session duration in milliseconds
 * @returns Array of presentation events with durations and data
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Complex timeline parsing logic that processes multiple event types with different data structures
export function buildPresentationQueue(
  messages: LLMMessage[],
  toolCalls: ToolCall[],
  pipelineStages: PipelineStageEvent[],
  sessionDurationMs?: number,
): PresentationEvent[] {
  const events: PresentationEvent[] = [];

  // 1. Generation start
  events.push({
    type: 'generation-start',
    duration: 6000, // 6 seconds - Loading simulation (2s) + Power-ups (3s) + READY (0.5s) + VIBE CODE (0.5s)
  });

  // 2. Collect all timeline events with timestamps for chronological processing
  type TimelineEvent =
    | { type: 'stage'; timestamp: number; stage: PipelineStageEvent }
    | { type: 'toolCall'; timestamp: number; toolCall: ToolCall };

  const timelineEvents: TimelineEvent[] = [
    ...pipelineStages.map((stage) => ({
      type: 'stage' as const,
      timestamp: stage.timestamp,
      stage,
    })),
    ...toolCalls.map((toolCall) => ({
      type: 'toolCall' as const,
      timestamp: toolCall.timestamp,
      toolCall,
    })),
  ];

  // Sort by timestamp for chronological processing
  timelineEvents.sort((a, b) => a.timestamp - b.timestamp);

  // 3. Process events in chronological order
  let totalFileWrites = 0;

  for (const event of timelineEvents) {
    if (event.type === 'stage') {
      const stage = event.stage;

      switch (stage.type) {
        case 'template_loading': {
          if (stage.status === 'started') {
            events.push({
              type: 'template-loading',
              duration: 3000, // 3 seconds
            });
          }
          break;
        }

        case 'planning': {
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
              const name =
                route.method && route.path ? `${route.method} ${route.path}` : route.path;
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
          break;
        }

        case 'validation': {
          if (stage.status === 'started') {
            // Determine validation type from errors (if prisma errors, it's prisma validation)
            const isPrisma =
              stage.data?.validationErrors?.some((e) => e.type === 'prisma') ?? false;
            events.push({
              type: isPrisma ? 'validation-prisma' : 'validation-typescript',
              duration: 3000,
            });
          } else if (stage.status === 'completed' || stage.status === 'failed') {
            const passed = stage.status === 'completed';
            const errorCount = stage.data?.validationErrors?.length || 0;
            const iteration = stage.data?.iteration;

            events.push({
              type: 'validation-result',
              duration: passed ? 2000 : 3000,
              data: {
                validationResult: { passed, errorCount, iteration },
              },
            });
          }
          break;
        }
      }
    } else if (event.type === 'toolCall') {
      const toolCall = event.toolCall;

      switch (toolCall.name) {
        case 'requestBlock': {
          const args = safeParse<RequestBlockArgs>(toolCall.args);
          if (!args) break;

          const blockName = args.blockName || args.blockId || 'Building Block';
          events.push({
            type: 'block-request',
            duration: 3000,
            data: { blockName },
          });
          break;
        }

        case 'writeFile': {
          totalFileWrites++;
          const fileName = extractFileFromToolCall(toolCall);
          events.push({
            type: 'file-created',
            duration: 500,
            data: { fileName: fileName || `file-${totalFileWrites}` },
          });

          // Show combo milestone right after milestone files (5, 10, 20, 30, etc.)
          if (
            totalFileWrites === 5 ||
            totalFileWrites === 10 ||
            (totalFileWrites >= 20 && totalFileWrites % 10 === 0)
          ) {
            events.push({
              type: 'combo-milestone',
              duration: 2000,
              data: { comboMilestone: totalFileWrites },
            });
          }
          break;
        }
      }
    }
  }

  // 4. Check for errors
  const lastMessage = messages[messages.length - 1];
  const hasError = lastMessage?.role === 'system' && lastMessage.content.includes('error');

  if (hasError) {
    events.push({
      type: 'error-ko',
      duration: 4000, // 4 seconds - dramatic K.O.
    });
  } else {
    // 5. Victory screen with stats
    // Use provided session duration or calculate from timestamps
    const sessionDuration = sessionDurationMs
      ? sessionDurationMs / 1000
      : messages.length > 0
        ? (messages[messages.length - 1].timestamp - messages[0].timestamp) / 1000
        : 0;

    events.push({
      type: 'victory',
      duration: 6000, // 6 seconds - celebrate!
      data: {
        stats: {
          duration: sessionDuration,
          toolCalls: toolCalls.length,
          filesCreated: totalFileWrites,
          successRate: 100,
          combos: Math.max(10, totalFileWrites), // Use file count as combo proxy
        },
      },
    });
  }

  return events;
}

/**
 * Extract file path from tool call arguments
 */
function extractFileFromToolCall(toolCall: ToolCall): string | undefined {
  if (!toolCall.args) return undefined;

  const args = safeParse<WriteFileArgs>(toolCall.args);
  return args?.path || args?.file_path || args?.fileName;
}
