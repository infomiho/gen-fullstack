import type { LLMMessage, ToolCall, PipelineStageEvent } from '@gen-fullstack/shared';
import type { PresentationEvent } from '../stores/presentationStore';
import {
  parseTemplateLoadingStage,
  parsePlanningStage,
  parseValidationStage,
  parseBlockRequestTool,
  parseWriteFileTool,
} from './presentation-event-parsers';

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
          const parsed = parseTemplateLoadingStage(stage);
          if (parsed) events.push(parsed);
          break;
        }

        case 'planning': {
          const parsed = parsePlanningStage(stage);
          events.push(...parsed);
          break;
        }

        case 'validation': {
          const parsed = parseValidationStage(stage);
          if (parsed) events.push(parsed);
          break;
        }
      }
    } else if (event.type === 'toolCall') {
      const toolCall = event.toolCall;

      switch (toolCall.name) {
        case 'requestBlock': {
          const parsed = parseBlockRequestTool(toolCall);
          if (parsed) events.push(parsed);
          break;
        }

        case 'writeFile': {
          const parsed = parseWriteFileTool(toolCall, totalFileWrites);
          events.push(...parsed);
          totalFileWrites++;
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
