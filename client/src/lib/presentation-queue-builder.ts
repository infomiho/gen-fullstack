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
 * Timeline event type for unified processing
 */
type TimelineEvent =
  | { type: 'stage'; timestamp: number; stage: PipelineStageEvent }
  | { type: 'toolCall'; timestamp: number; toolCall: ToolCall };

/**
 * Create unified timeline from pipeline stages and tool calls
 */
function createTimelineEvents(
  pipelineStages: PipelineStageEvent[],
  toolCalls: ToolCall[],
): TimelineEvent[] {
  const events: TimelineEvent[] = [
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

  return events.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Process a pipeline stage event and add presentation events
 */
function processStageEvent(stage: PipelineStageEvent, events: PresentationEvent[]): void {
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
}

/**
 * Process a tool call event and add presentation events
 */
function processToolCallEvent(
  toolCall: ToolCall,
  totalFileWrites: number,
  events: PresentationEvent[],
): number {
  switch (toolCall.name) {
    case 'requestBlock': {
      const parsed = parseBlockRequestTool(toolCall);
      if (parsed) events.push(parsed);
      return totalFileWrites;
    }
    case 'writeFile': {
      const parsed = parseWriteFileTool(toolCall, totalFileWrites);
      events.push(...parsed);
      return totalFileWrites + 1;
    }
    default:
      return totalFileWrites;
  }
}

/**
 * Check if session ended with an error
 */
function hasErrorEnding(messages: LLMMessage[]): boolean {
  const lastMessage = messages[messages.length - 1];
  return lastMessage?.role === 'system' && lastMessage.content.includes('error');
}

/**
 * Calculate session duration from messages or provided value
 */
function calculateSessionDuration(messages: LLMMessage[], providedDurationMs?: number): number {
  if (providedDurationMs) return providedDurationMs / 1000;
  if (messages.length === 0) return 0;

  const firstTimestamp = messages[0].timestamp;
  const lastTimestamp = messages[messages.length - 1].timestamp;
  return (lastTimestamp - firstTimestamp) / 1000;
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

  // 2. Create unified timeline sorted by timestamp
  const timelineEvents = createTimelineEvents(pipelineStages, toolCalls);

  // 3. Process events in chronological order
  let totalFileWrites = 0;

  for (const event of timelineEvents) {
    if (event.type === 'stage') {
      processStageEvent(event.stage, events);
    } else {
      totalFileWrites = processToolCallEvent(event.toolCall, totalFileWrites, events);
    }
  }

  // 4. Add error or victory ending
  if (hasErrorEnding(messages)) {
    events.push({
      type: 'error-ko',
      duration: 4000, // 4 seconds - dramatic K.O.
    });
  } else {
    const sessionDuration = calculateSessionDuration(messages, sessionDurationMs);

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
