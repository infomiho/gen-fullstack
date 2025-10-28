import type {
  FileUpdate,
  LLMMessage,
  PipelineStageEvent,
  ToolCall,
  ToolResult,
} from '@gen-fullstack/shared';
import { useMemo } from 'react';

/**
 * Safely parse JSON with fallback
 */
function safeJsonParse<T>(json: string | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    // biome-ignore lint/suspicious/noConsole: Useful for debugging malformed JSON data
    console.warn('Failed to parse JSON:', json, error);
    return fallback;
  }
}

/**
 * Session data structure from the API
 */
interface SessionTimeline {
  id: number;
  sessionId: string;
  timestamp: Date;
  type: 'message' | 'tool_call' | 'tool_result' | 'pipeline_stage';
  // Message fields
  messageId?: string;
  role?: 'user' | 'assistant' | 'system';
  content?: string;
  // Tool call fields
  toolCallId?: string;
  toolName?: string;
  toolArgs?: string;
  toolReason?: string;
  // Tool result fields
  toolResultId?: string;
  toolResultFor?: string;
  result?: string;
  isError?: boolean;
  // Pipeline stage fields
  stageId?: string;
  stageType?: 'planning' | 'validation' | 'template_loading' | 'completing';
  stageStatus?: 'started' | 'completed' | 'failed';
  stageData?: string; // JSON string
}

interface SessionFile {
  id: number;
  sessionId: string;
  path: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Helper: Convert persisted timeline messages to client format
 */
function convertPersistedMessages(timeline: SessionTimeline[]): LLMMessage[] {
  return timeline
    .filter((item) => item.type === 'message' && item.role && item.content !== undefined)
    .map((item) => ({
      // Use messageId from database for proper deduplication with live messages
      id: item.messageId || `persisted-${item.id}`,
      role: item.role as 'user' | 'assistant' | 'system',
      content: item.content || '',
      timestamp: new Date(item.timestamp).getTime(),
    }));
}

/**
 * Helper: Convert persisted timeline tool calls to client format
 */
function convertPersistedToolCalls(timeline: SessionTimeline[]): ToolCall[] {
  return timeline
    .filter((item) => item.type === 'tool_call' && item.toolCallId && item.toolName)
    .map((item) => ({
      id: item.toolCallId as string,
      name: item.toolName as string,
      args: safeJsonParse<Record<string, unknown>>(item.toolArgs, {}),
      reason: item.toolReason,
      timestamp: new Date(item.timestamp).getTime(),
    }));
}

/**
 * Helper: Convert persisted timeline tool results to client format
 */
function convertPersistedToolResults(timeline: SessionTimeline[]): ToolResult[] {
  return timeline
    .filter((item) => item.type === 'tool_result' && item.toolResultId)
    .map((item) => ({
      id: item.toolResultId as string,
      toolName: item.toolName || '',
      result: item.result || '',
      timestamp: new Date(item.timestamp).getTime(),
    }));
}

/**
 * Helper: Convert persisted timeline pipeline stages to client format
 */
function convertPersistedPipelineStages(timeline: SessionTimeline[]): PipelineStageEvent[] {
  return timeline
    .filter((item) => item.type === 'pipeline_stage' && item.stageId && item.stageType)
    .map((item) => ({
      id: item.stageId as string,
      type: item.stageType as 'planning' | 'validation' | 'template_loading' | 'completing',
      status: (item.stageStatus as 'started' | 'completed' | 'failed') || 'started',
      timestamp: new Date(item.timestamp).getTime(),
      data: safeJsonParse<Record<string, unknown>>(item.stageData, {}),
    }));
}

/**
 * Helper: Convert persisted files to client format
 */
function convertPersistedFiles(files: SessionFile[]): FileUpdate[] {
  return files.map((file) => ({
    path: file.path,
    content: file.content,
  }));
}

/**
 * Helper: Merge and deduplicate arrays by ID
 */
function mergeByIdAndSort<T extends { id: string; timestamp: number }>(
  persisted: T[],
  live: T[],
): T[] {
  return Array.from(new Map([...persisted, ...live].map((item) => [item.id, item])).values()).sort(
    (a, b) => a.timestamp - b.timestamp,
  );
}

/**
 * Helper: Merge files by path (no timestamp sorting needed)
 */
function mergeByPath(persisted: FileUpdate[], live: FileUpdate[]): FileUpdate[] {
  return Array.from(new Map([...persisted, ...live].map((file) => [file.path, file])).values());
}

/**
 * Parameters for useSessionData hook
 */
export interface UseSessionDataParams {
  /** Persisted timeline items from database */
  timeline: SessionTimeline[];
  /** Persisted files from database */
  persistedFiles: SessionFile[];
  /** Live messages from WebSocket */
  liveMessages: LLMMessage[];
  /** Live tool calls from WebSocket */
  liveToolCalls: ToolCall[];
  /** Live tool results from WebSocket */
  liveToolResults: ToolResult[];
  /** Live pipeline stages from WebSocket */
  livePipelineStages: PipelineStageEvent[];
  /** Live files from WebSocket */
  liveFiles: FileUpdate[];
  /** Whether the session is still generating */
  isActiveSession: boolean;
  /** Whether we're connected to the session room and receiving live updates */
  isConnectedToRoom: boolean;
}

/**
 * Custom hook to manage session data merging
 *
 * Handles conversion of persisted data and merging with live WebSocket data
 * when viewing an active session.
 *
 * @param params - Object containing all session data and flags
 * @returns Merged messages, tool calls, tool results, pipeline stages, and files
 */
export function useSessionData(params: UseSessionDataParams) {
  const {
    timeline,
    persistedFiles: persistedFilesData,
    liveMessages,
    liveToolCalls,
    liveToolResults,
    livePipelineStages,
    liveFiles,
    isConnectedToRoom,
  } = params;
  // Convert persisted timeline items to client types (memoized)
  const persistedMessages = useMemo(() => convertPersistedMessages(timeline), [timeline]);
  const persistedToolCalls = useMemo(() => convertPersistedToolCalls(timeline), [timeline]);
  const persistedToolResults = useMemo(() => convertPersistedToolResults(timeline), [timeline]);
  const persistedPipelineStages = useMemo(
    () => convertPersistedPipelineStages(timeline),
    [timeline],
  );
  const persistedFiles = useMemo(
    () => convertPersistedFiles(persistedFilesData),
    [persistedFilesData],
  );

  // Merge live data if we're connected to the session room
  // This allows live updates to work for any viewer (not just the creator)
  // regardless of whether the session is actively generating or already completed
  // Memoize the merged results to prevent unnecessary re-renders
  const messages = useMemo(
    () =>
      isConnectedToRoom ? mergeByIdAndSort(persistedMessages, liveMessages) : persistedMessages,
    [isConnectedToRoom, persistedMessages, liveMessages],
  );

  const toolCalls = useMemo(
    () =>
      isConnectedToRoom ? mergeByIdAndSort(persistedToolCalls, liveToolCalls) : persistedToolCalls,
    [isConnectedToRoom, persistedToolCalls, liveToolCalls],
  );

  const toolResults = useMemo(
    () =>
      isConnectedToRoom
        ? mergeByIdAndSort(persistedToolResults, liveToolResults)
        : persistedToolResults,
    [isConnectedToRoom, persistedToolResults, liveToolResults],
  );

  const pipelineStages = useMemo(
    () =>
      isConnectedToRoom
        ? mergeByIdAndSort(persistedPipelineStages, livePipelineStages)
        : persistedPipelineStages,
    [isConnectedToRoom, persistedPipelineStages, livePipelineStages],
  );

  const files = useMemo(
    () => (isConnectedToRoom ? mergeByPath(persistedFiles, liveFiles) : persistedFiles),
    [isConnectedToRoom, persistedFiles, liveFiles],
  );

  return { messages, toolCalls, toolResults, pipelineStages, files };
}
