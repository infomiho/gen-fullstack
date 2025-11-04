import type { Socket } from 'socket.io-client';
import type { LLMMessage, PipelineStageEvent, ToolCall, ToolResult } from '@gen-fullstack/shared';
import { useMemo } from 'react';
import { useWebSocket } from './useWebSocket';
import { useSessionWebSocket } from './useSessionWebSocket';
import { useSessionData } from './useSessionData';
import { useReplayMode } from './useReplayMode';
import type { SessionData } from '../pages/SessionPage';

/**
 * Session status determination
 */
function getSessionStatus(
  socket: Socket | null,
  isSubscribed: boolean,
  isGeneratingWebSocket: boolean,
  sessionStatus: 'generating' | 'completed' | 'failed',
) {
  const isActiveSession = socket ? isGeneratingWebSocket : sessionStatus === 'generating';
  const isConnectedToRoom = Boolean(socket?.connected && isSubscribed);
  const isOwnSession = socket !== null && isActiveSession;

  return { isActiveSession, isConnectedToRoom, isOwnSession };
}

/**
 * Select data source based on replay mode
 */
function selectDataSource<TFile>(
  isReplayMode: boolean,
  replayData: {
    messages: LLMMessage[];
    toolCalls: ToolCall[];
    toolResults: ToolResult[];
    pipelineStages: PipelineStageEvent[];
    files: TFile[];
  },
  persistedData: {
    messages: LLMMessage[];
    toolCalls: ToolCall[];
    toolResults: ToolResult[];
    pipelineStages: PipelineStageEvent[];
    files: TFile[];
  },
) {
  return {
    messages: isReplayMode ? replayData.messages : persistedData.messages,
    toolCalls: isReplayMode ? replayData.toolCalls : persistedData.toolCalls,
    toolResults: isReplayMode ? replayData.toolResults : persistedData.toolResults,
    pipelineStages: isReplayMode ? replayData.pipelineStages : persistedData.pipelineStages,
    files: isReplayMode ? replayData.files : persistedData.files,
  };
}

/**
 * Custom hook that encapsulates all session data logic
 *
 * Handles:
 * - WebSocket connection
 * - Live vs persisted data merging
 * - Replay mode data switching
 * - Session status determination
 *
 * Returns unified data interface regardless of mode
 */
export function useSessionDataLayer(sessionId: string | undefined, sessionData: SessionData) {
  // WebSocket connection for live updates
  const webSocketData = useWebSocket();
  const {
    socket,
    isConnected,
    isGenerating: isGeneratingWebSocket,
    messages: liveMessages,
    toolCalls: liveToolCalls,
    toolResults: liveToolResults,
    pipelineStages: livePipelineStages,
    files: liveFiles,
    appStatus,
    appLogs,
    startApp,
    stopApp,
    saveFile,
  } = webSocketData;

  // Subscribe to session WebSocket events
  const isSubscribed = useSessionWebSocket(socket, sessionId);

  // Determine session connection and generation status
  const { isActiveSession, isConnectedToRoom, isOwnSession } = getSessionStatus(
    socket,
    isSubscribed,
    isGeneratingWebSocket,
    sessionData.session.status,
  );

  // Merge persisted and live data
  const persistedData = useSessionData({
    timeline: sessionData.timeline,
    persistedFiles: sessionData.files,
    liveMessages,
    liveToolCalls,
    liveToolResults,
    livePipelineStages,
    liveFiles,
    isActiveSession,
    isConnectedToRoom,
  });

  // Replay mode data
  const { isReplayMode, replayData } = useReplayMode();

  // Select data source based on replay mode (memoized to prevent unnecessary re-renders)
  const currentData = useMemo(
    () => selectDataSource(isReplayMode, replayData, persistedData),
    [isReplayMode, replayData, persistedData],
  );

  return {
    // Data
    messages: currentData.messages,
    toolCalls: currentData.toolCalls,
    toolResults: currentData.toolResults,
    pipelineStages: currentData.pipelineStages,
    files: currentData.files,
    persistedData, // Full persisted data (for presentation mode)

    // WebSocket state
    socket,
    isConnected,
    isSubscribed,

    // Session state
    isActiveSession,
    isConnectedToRoom,
    isOwnSession,
    isReplayMode,

    // App execution
    appStatus,
    appLogs,
    startApp,
    stopApp,
    saveFile,
  };
}
