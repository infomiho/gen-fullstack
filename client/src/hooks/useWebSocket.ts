import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

interface ToolResult {
  id: string;
  result: string;
}

interface GenerationMetrics {
  success: boolean;
  tokensUsed?: number;
  timeElapsed?: number;
  iterations?: number;
}

interface UseWebSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  isGenerating: boolean;
  messages: LLMMessage[];
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
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

  useEffect(() => {
    const newSocket = io(SERVER_URL);

    newSocket.on('connect', () => {
      console.log('Connected to server');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from server');
      setIsConnected(false);
    });

    newSocket.on('llm_message', (message: LLMMessage) => {
      setMessages((prev) => {
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

    newSocket.on('generation_complete', (metrics: GenerationMetrics) => {
      console.log('Generation complete:', metrics);
      setIsGenerating(false);
      setMessages((prev) => {
        const newMessages = [
          ...prev,
          {
            role: 'system' as const,
            content: `Generation completed: ${metrics.success ? 'Success' : 'Failed'}`,
          },
        ];
        return newMessages.slice(-MAX_MESSAGES);
      });
    });

    newSocket.on('error', (error: string) => {
      console.error('Server error:', error);
      setIsGenerating(false);
      setMessages((prev) => {
        const newMessages = [
          ...prev,
          {
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
  }, []);

  return {
    socket,
    isConnected,
    isGenerating,
    messages,
    toolCalls,
    toolResults,
    startGeneration,
    stopGeneration,
    clearMessages,
  };
}
