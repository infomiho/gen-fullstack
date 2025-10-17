import type { FileUpdate, LLMMessage, ToolCall, ToolResult } from '@gen-fullstack/shared';
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
  type: 'message' | 'tool_call' | 'tool_result';
  // Message fields
  messageId?: string;
  role?: 'user' | 'assistant' | 'system';
  content?: string;
  // Tool call fields
  toolCallId?: string;
  toolName?: string;
  toolArgs?: string;
  // Tool result fields
  toolResultId?: string;
  toolResultFor?: string;
  result?: string;
  isError?: boolean;
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
  /** Live files from WebSocket */
  liveFiles: FileUpdate[];
  /** Whether the session is still generating */
  isActiveSession: boolean;
  /** Whether we're connected and viewing our own active session */
  isOwnSession: boolean;
}

/**
 * Custom hook to manage session data merging
 *
 * Handles conversion of persisted data and merging with live WebSocket data
 * when viewing an active session.
 *
 * @param params - Object containing all session data and flags
 * @returns Merged messages, tool calls, tool results, and files
 */
export function useSessionData(params: UseSessionDataParams) {
  const {
    timeline,
    persistedFiles: persistedFilesData,
    liveMessages,
    liveToolCalls,
    liveToolResults,
    liveFiles,
    isActiveSession,
    isOwnSession,
  } = params;
  // Convert persisted timeline items to client types (memoized)
  const persistedMessages = useMemo(() => convertPersistedMessages(timeline), [timeline]);
  const persistedToolCalls = useMemo(() => convertPersistedToolCalls(timeline), [timeline]);
  const persistedToolResults = useMemo(() => convertPersistedToolResults(timeline), [timeline]);
  const persistedFiles = useMemo(
    () => convertPersistedFiles(persistedFilesData),
    [persistedFilesData],
  );

  // Only merge live data if this is our own active session
  // Otherwise, live updates won't work due to session/socket ID mismatch
  // Memoize the merged results to prevent unnecessary re-renders
  const messages = useMemo(
    () =>
      isActiveSession && isOwnSession
        ? mergeByIdAndSort(persistedMessages, liveMessages)
        : persistedMessages,
    [isActiveSession, isOwnSession, persistedMessages, liveMessages],
  );

  const toolCalls = useMemo(
    () =>
      isActiveSession && isOwnSession
        ? mergeByIdAndSort(persistedToolCalls, liveToolCalls)
        : persistedToolCalls,
    [isActiveSession, isOwnSession, persistedToolCalls, liveToolCalls],
  );

  const toolResults = useMemo(
    () =>
      isActiveSession && isOwnSession
        ? mergeByIdAndSort(persistedToolResults, liveToolResults)
        : persistedToolResults,
    [isActiveSession, isOwnSession, persistedToolResults, liveToolResults],
  );

  const files = useMemo(
    () =>
      isActiveSession && isOwnSession ? mergeByPath(persistedFiles, liveFiles) : persistedFiles,
    [isActiveSession, isOwnSession, persistedFiles, liveFiles],
  );

  return { messages, toolCalls, toolResults, files };
}
