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
import { MAX_LOGS, MAX_MESSAGES, TIMEOUTS } from '@gen-fullstack/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

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
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LLMMessage[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [toolResults, setToolResults] = useState<ToolResult[]>([]);
  const [files, setFiles] = useState<FileUpdate[]>([]);
  // App execution state
  const [appStatus, setAppStatus] = useState<AppInfo | null>(null);
  const [appLogs, setAppLogs] = useState<AppLog[]>([]);
  const [buildEvents, setBuildEvents] = useState<BuildEvent[]>([]);

  // Use ref to track currentSessionId for event listeners
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    const newSocket = io(SERVER_URL);

    newSocket.on('connect', () => {
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('session_started', ({ sessionId }) => {
      setCurrentSessionId(sessionId);
      sessionIdRef.current = sessionId;
    });

    newSocket.on('llm_message', (message: LLMMessage) => {
      setMessages((prev) => {
        // Find existing message with same ID to accumulate content
        const existingIndex = prev.findIndex((m) => m.id === message.id);

        if (existingIndex >= 0) {
          // Accumulate content into existing message
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            content: updated[existingIndex].content + message.content,
          };
          return updated.slice(-MAX_MESSAGES);
        }

        // New message - add to list
        const newMessages = [...prev, message];
        return newMessages.slice(-MAX_MESSAGES);
      });
    });

    newSocket.on('tool_call', (toolCall: ToolCall) => {
      setToolCalls((prev) => {
        const newToolCalls = [...prev, toolCall];
        return newToolCalls.slice(-MAX_MESSAGES);
      });
    });

    newSocket.on('tool_result', (result: ToolResult) => {
      setToolResults((prev) => {
        const newToolResults = [...prev, result];
        return newToolResults.slice(-MAX_MESSAGES);
      });
    });

    newSocket.on('file_updated', (file: FileUpdate) => {
      setFiles((prev) => {
        const existing = prev.findIndex((f) => f.path === file.path);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = file;
          return updated;
        }
        return [...prev, file];
      });
    });

    newSocket.on('generation_complete', (metrics: GenerationMetrics) => {
      setIsGenerating(false);
      setMessages((prev) => {
        const newMessages = [
          ...prev,
          {
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            role: 'system' as const,
            content: `Generation completed! Tokens: ${metrics.totalTokens}, Cost: $${metrics.cost.toFixed(4)}, Duration: ${(metrics.duration / 1000).toFixed(1)}s`,
            timestamp: Date.now(),
          },
        ];
        return newMessages.slice(-MAX_MESSAGES);
      });

      // Auto-start the app after a short delay to let files finish writing
      if (sessionIdRef.current) {
        setTimeout(() => {
          newSocket.emit('start_app', { sessionId: sessionIdRef.current });
        }, TIMEOUTS.AUTO_START_DELAY);
      }
    });

    newSocket.on('error', (error: string) => {
      setIsGenerating(false);
      setMessages((prev) => {
        const newMessages = [
          ...prev,
          {
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            role: 'system' as const,
            content: `Error: ${error}`,
            timestamp: Date.now(),
          },
        ];
        return newMessages.slice(-MAX_MESSAGES);
      });
    });

    // App execution events
    newSocket.on('app_status', (data: AppInfo) => {
      setAppStatus(data);
    });

    newSocket.on('app_log', (log: AppLog) => {
      setAppLogs((prev) => {
        const newLogs = [...prev, log];
        // Keep last N logs to prevent memory issues
        return newLogs.slice(-MAX_LOGS);
      });
    });

    newSocket.on('build_event', (event: BuildEvent) => {
      setBuildEvents((prev) => [...prev, event]);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const startGeneration = useCallback(
    (prompt: string, strategy: string) => {
      if (socket) {
        setMessages([]);
        setToolCalls([]);
        setToolResults([]);
        setFiles([]);
        setIsGenerating(true);
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
    setMessages([]);
    setToolCalls([]);
    setToolResults([]);
    setFiles([]);
    setCurrentSessionId(null);
    sessionIdRef.current = null;
    setAppStatus(null);
    setAppLogs([]);
    setBuildEvents([]);
  }, []);

  const startApp = useCallback(
    (sessionId: string) => {
      if (socket) {
        // Clear old logs before starting
        setAppLogs([]);
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
