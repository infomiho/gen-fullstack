import type {
  LLMMessage,
  ToolCall,
  ToolResult,
  FileUpdate,
  PipelineStageEvent,
} from '@gen-fullstack/shared';

/**
 * Replay utility functions
 *
 * Transforms replay timeline data into client-side types
 */

interface ReplayTimelineItem {
  id: string;
  type: 'message' | 'tool_call' | 'tool_result' | 'pipeline_stage';
  timestamp: number;
  data: {
    role?: string;
    content?: string;
    name?: string;
    parameters?: Record<string, unknown>;
    toolCallId?: string;
    toolName?: string;
    result?: string;
    type?: 'planning' | 'validation' | 'template_loading' | 'completing';
    status?: 'started' | 'completed' | 'failed';
    data?: Record<string, unknown>;
  };
}

interface ReplayFile {
  path: string;
  timestamp: number;
  content: string;
}

/**
 * Filter and convert timeline items to messages up to currentTime
 */
export function getReplayMessages(
  timelineItems: ReplayTimelineItem[],
  sessionStartTime: number,
  currentTime: number,
): LLMMessage[] {
  const absoluteCurrentTime = sessionStartTime + currentTime;

  return timelineItems
    .filter(
      (item) =>
        item.type === 'message' &&
        item.timestamp <= absoluteCurrentTime &&
        item.data.role &&
        item.data.content !== undefined,
    )
    .map((item) => ({
      id: item.id,
      role: item.data.role as 'user' | 'assistant' | 'system',
      content: item.data.content as string,
      timestamp: item.timestamp,
    }));
}

/**
 * Filter and convert timeline items to tool calls up to currentTime
 */
export function getReplayToolCalls(
  timelineItems: ReplayTimelineItem[],
  sessionStartTime: number,
  currentTime: number,
): ToolCall[] {
  const absoluteCurrentTime = sessionStartTime + currentTime;

  return timelineItems
    .filter(
      (item) =>
        item.type === 'tool_call' &&
        item.timestamp <= absoluteCurrentTime &&
        item.data.name &&
        item.data.parameters,
    )
    .map((item) => ({
      id: item.id,
      name: item.data.name as string,
      args: item.data.parameters as Record<string, unknown>,
      timestamp: item.timestamp,
    }));
}

/**
 * Filter and convert timeline items to tool results up to currentTime
 */
export function getReplayToolResults(
  timelineItems: ReplayTimelineItem[],
  sessionStartTime: number,
  currentTime: number,
): ToolResult[] {
  const absoluteCurrentTime = sessionStartTime + currentTime;

  return timelineItems
    .filter(
      (item) =>
        item.type === 'tool_result' &&
        item.timestamp <= absoluteCurrentTime &&
        item.data.result !== undefined,
    )
    .map((item) => ({
      // Format ID as "result-{toolCallId}" to match live mode format
      // This allows Timeline component to match results to tool calls
      id: item.data.toolCallId ? `result-${item.data.toolCallId}` : item.id,
      toolName: item.data.toolName || '',
      result: item.data.result as string,
      timestamp: item.timestamp,
    }));
}

/**
 * Filter and convert timeline items to pipeline stages up to currentTime
 */
export function getReplayPipelineStages(
  timelineItems: ReplayTimelineItem[],
  sessionStartTime: number,
  currentTime: number,
): PipelineStageEvent[] {
  const absoluteCurrentTime = sessionStartTime + currentTime;

  return timelineItems
    .filter(
      (item) =>
        item.type === 'pipeline_stage' &&
        item.timestamp <= absoluteCurrentTime &&
        item.data.type &&
        item.data.status,
    )
    .map((item) => ({
      id: item.id,
      type: item.data.type as 'planning' | 'validation' | 'template_loading' | 'completing',
      status: item.data.status as 'started' | 'completed' | 'failed',
      timestamp: item.timestamp,
      data: item.data.data || {},
    }));
}

/**
 * Filter files up to currentTime
 */
export function getReplayFiles(
  files: ReplayFile[],
  sessionStartTime: number,
  currentTime: number,
): FileUpdate[] {
  const absoluteCurrentTime = sessionStartTime + currentTime;

  return files
    .filter((file) => file.timestamp <= absoluteCurrentTime)
    .map((file) => ({
      path: file.path,
      content: file.content,
    }));
}

/**
 * Format milliseconds to MM:SS format
 */
export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
