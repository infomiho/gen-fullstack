import type {
  AppInfo,
  AppLog,
  BuildEvent,
  FileUpdate,
  GenerationMetrics,
  LLMMessage,
  ToolCall,
  ToolResult,
} from '@gen-fullstack/shared';
import { TIMEOUTS } from '@gen-fullstack/shared';
import { useCallback, useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useToast } from '../components/ToastProvider';
import { useAppStore, useConnectionStore, useGenerationStore } from '../stores';

interface UseWebSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  isGenerating: boolean;
  currentSessionId: string | null;
  messages: LLMMessage[];
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
  files: FileUpdate[];
  // App execution state
  appStatus: AppInfo | null;
  appLogs: AppLog[];
  buildEvents: BuildEvent[];
  // Generation functions
  startGeneration: (prompt: string, strategy: string) => void;
  stopGeneration: () => void;
  clearMessages: () => void;
  // App execution functions
  startApp: (sessionId: string) => void;
  stopApp: (sessionId: string) => void;
  // File editing functions
  saveFile: (sessionId: string, path: string, content: string) => void;
}

const SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function useWebSocket(): UseWebSocketReturn {
  const { showToast } = useToast();

  // Get stores
  const socket = useConnectionStore((state) => state.socket);
  const isConnected = useConnectionStore((state) => state.isConnected);
  const setSocket = useConnectionStore((state) => state.setSocket);
  const setConnected = useConnectionStore((state) => state.setConnected);

  const isGenerating = useGenerationStore((state) => state.isGenerating);
  const currentSessionId = useGenerationStore((state) => state.currentSessionId);
  const messages = useGenerationStore((state) => state.messages);
  const toolCalls = useGenerationStore((state) => state.toolCalls);
  const toolResults = useGenerationStore((state) => state.toolResults);
  const files = useGenerationStore((state) => state.files);

  const appStatus = useAppStore((state) => state.appStatus);
  const appLogs = useAppStore((state) => state.appLogs);
  const buildEvents = useAppStore((state) => state.buildEvents);

  // Stable ref for showToast to avoid re-renders
  const showToastRef = useRef(showToast);
  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  // Debouncing for truncation notifications (max once per 10 seconds per type)
  const lastTruncationToast = useRef<Record<string, number>>({});
  const notifyTruncation = useCallback((title: string, message: string, type: string) => {
    const now = Date.now();
    const lastShown = lastTruncationToast.current[type] || 0;
    if (now - lastShown > 10000) {
      showToastRef.current(title, message, 'info');
      lastTruncationToast.current[type] = now;
    }
  }, []);

  useEffect(() => {
    // Check if socket already exists in store (persists across navigation)
    let newSocket = useConnectionStore.getState().socket;
    let shouldSetSocket = false;

    if (!newSocket || !newSocket.connected) {
      try {
        newSocket = io(SERVER_URL, {
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
          reconnectionAttempts: 5,
        });
        shouldSetSocket = true;

        // Handle connection errors
        newSocket.on('connect_error', (_error) => {
          showToastRef.current(
            'Connection Error',
            'Failed to connect to server. Retrying...',
            'error',
          );
        });
      } catch (_error) {
        showToastRef.current(
          'Connection Failed',
          'Could not establish connection to server.',
          'error',
        );
        return;
      }
    } else {
    }

    // Define all handlers as named functions for proper cleanup
    const handleConnect = () => {
      setConnected(true);
    };

    const handleDisconnect = () => {
      setConnected(false);
    };

    const handleSessionStarted = ({ sessionId }: { sessionId: string }) => {
      useGenerationStore.getState().setSessionId(sessionId);
    };

    const handleLLMMessage = (message: LLMMessage) => {
      useGenerationStore.getState().addMessage(message);

      // Check for truncation and notify user
      const { truncated, count, type } = useGenerationStore.getState().checkAndTruncate();
      if (truncated) {
        notifyTruncation(
          'Message Limit Reached',
          `${count} oldest ${type === 'messages' ? 'messages' : 'tool calls'} removed to maintain performance.`,
          type,
        );
      }
    };

    const handleToolCall = (toolCall: ToolCall) => {
      useGenerationStore.getState().addToolCall(toolCall);

      // Check for truncation and notify user
      const { truncated, count, type } = useGenerationStore.getState().checkAndTruncate();
      if (truncated) {
        notifyTruncation(
          'Tool Call Limit Reached',
          `${count} oldest ${type === 'toolCalls' ? 'tool calls' : 'items'} removed to maintain performance.`,
          type,
        );
      }
    };

    const handleToolResult = (result: ToolResult) => {
      useGenerationStore.getState().addToolResult(result);
    };

    const handleFileUpdated = (file: FileUpdate) => {
      useGenerationStore.getState().updateFile(file);
    };

    const handleGenerationComplete = (metrics: GenerationMetrics) => {
      useGenerationStore.getState().setGenerating(false);
      useGenerationStore.getState().setMetrics(metrics);

      // Add completion message
      useGenerationStore.getState().addMessage({
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        role: 'system' as const,
        content: `Generation completed! Tokens: ${metrics.totalTokens}, Cost: $${metrics.cost.toFixed(4)}, Duration: ${(metrics.duration / 1000).toFixed(1)}s`,
        timestamp: Date.now(),
      });

      // Auto-start the app after a short delay to let files finish writing
      const sessionId = useGenerationStore.getState().currentSessionId;
      if (sessionId) {
        setTimeout(() => {
          newSocket.emit('start_app', { sessionId });
        }, TIMEOUTS.AUTO_START_DELAY);
      }
    };

    const handleError = (error: string) => {
      useGenerationStore.getState().setGenerating(false);

      // Add error message
      useGenerationStore.getState().addMessage({
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        role: 'system' as const,
        content: `Error: ${error}`,
        timestamp: Date.now(),
      });
    };

    const handleAppStatus = (data: AppInfo) => {
      useAppStore.getState().setAppStatus(data);
    };

    const handleAppLog = (log: AppLog) => {
      useAppStore.getState().addAppLog(log);

      // Check for log truncation
      const { truncated, count } = useAppStore.getState().checkAndTruncateLogs();
      if (truncated) {
        notifyTruncation(
          'Log Limit Reached',
          `${count} oldest logs removed to maintain performance.`,
          'logs',
        );
      }
    };

    const handleBuildEvent = (event: BuildEvent) => {
      useAppStore.getState().addBuildEvent(event);
    };

    // ALWAYS register handlers on every mount to prevent memory leaks
    // Remove any existing handlers first (prevents accumulation from previous mounts)
    newSocket.off('connect');
    newSocket.off('disconnect');
    newSocket.off('session_started');
    newSocket.off('llm_message');
    newSocket.off('tool_call');
    newSocket.off('tool_result');
    newSocket.off('file_updated');
    newSocket.off('generation_complete');
    newSocket.off('error');
    newSocket.off('app_status');
    newSocket.off('app_log');
    newSocket.off('build_event');

    // Register new handlers
    newSocket.on('connect', handleConnect);
    newSocket.on('disconnect', handleDisconnect);
    newSocket.on('session_started', handleSessionStarted);
    newSocket.on('llm_message', handleLLMMessage);
    newSocket.on('tool_call', handleToolCall);
    newSocket.on('tool_result', handleToolResult);
    newSocket.on('file_updated', handleFileUpdated);
    newSocket.on('generation_complete', handleGenerationComplete);
    newSocket.on('error', handleError);
    newSocket.on('app_status', handleAppStatus);
    newSocket.on('app_log', handleAppLog);
    newSocket.on('build_event', handleBuildEvent);

    if (shouldSetSocket) {
      setSocket(newSocket);
    }

    // Cleanup: Remove THIS mount's specific handlers
    // Socket persists, but we clean up our specific handler references
    return () => {
      newSocket.off('connect', handleConnect);
      newSocket.off('disconnect', handleDisconnect);
      newSocket.off('session_started', handleSessionStarted);
      newSocket.off('llm_message', handleLLMMessage);
      newSocket.off('tool_call', handleToolCall);
      newSocket.off('tool_result', handleToolResult);
      newSocket.off('file_updated', handleFileUpdated);
      newSocket.off('generation_complete', handleGenerationComplete);
      newSocket.off('error', handleError);
      newSocket.off('app_status', handleAppStatus);
      newSocket.off('app_log', handleAppLog);
      newSocket.off('build_event', handleBuildEvent);
    };
  }, [setSocket, setConnected, notifyTruncation]);

  const startGeneration = useCallback(
    (prompt: string, strategy: string) => {
      if (socket) {
        useGenerationStore.getState().reset();
        useGenerationStore.getState().setGenerating(true);
        socket.emit('start_generation', { prompt, strategy });
      }
    },
    [socket],
  );

  const stopGeneration = useCallback(() => {
    if (socket) {
      socket.emit('stop_generation');
    }
  }, [socket]);

  const clearMessages = useCallback(() => {
    useGenerationStore.getState().reset();
    useAppStore.getState().reset();
  }, []);

  const startApp = useCallback(
    (sessionId: string) => {
      if (socket) {
        // Clear old logs before starting
        useAppStore.getState().clearAppLogs();
        socket.emit('start_app', { sessionId });
      }
    },
    [socket],
  );

  const stopApp = useCallback(
    (sessionId: string) => {
      if (socket) {
        socket.emit('stop_app', { sessionId });
      }
    },
    [socket],
  );

  const saveFile = useCallback(
    (sessionId: string, path: string, content: string) => {
      if (socket) {
        socket.emit('save_file', { sessionId, path, content });
      }
    },
    [socket],
  );

  return {
    socket,
    isConnected,
    isGenerating,
    currentSessionId,
    messages,
    toolCalls,
    toolResults,
    files,
    // App execution state
    appStatus,
    appLogs,
    buildEvents,
    // Functions
    startGeneration,
    stopGeneration,
    clearMessages,
    startApp,
    stopApp,
    saveFile,
  };
}
