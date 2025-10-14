import type {
  FileUpdate,
  GenerationMetrics,
  LLMMessage,
  ToolCall,
  ToolResult,
} from '@gen-fullstack/shared';
import { useCallback, useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

interface UseWebSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  isGenerating: boolean;
  messages: LLMMessage[];
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
  files: FileUpdate[];
  startGeneration: (prompt: string, strategy: string) => void;
  stopGeneration: () => void;
  clearMessages: () => void;
}

const SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const MAX_MESSAGES = 1000;

export function useWebSocket(): UseWebSocketReturn {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [messages, setMessages] = useState<LLMMessage[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [toolResults, setToolResults] = useState<ToolResult[]>([]);
  const [files, setFiles] = useState<FileUpdate[]>([]);

  useEffect(() => {
    const newSocket = io(SERVER_URL);

    newSocket.on('connect', () => {
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
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
          },
        ];
        return newMessages.slice(-MAX_MESSAGES);
      });
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
          },
        ];
        return newMessages.slice(-MAX_MESSAGES);
      });
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
  }, []);

  return {
    socket,
    isConnected,
    isGenerating,
    messages,
    toolCalls,
    toolResults,
    files,
    startGeneration,
    stopGeneration,
    clearMessages,
  };
}
