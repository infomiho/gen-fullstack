/**
 * Tests for Generation Store
 *
 * Verifies state management for LLM generation:
 * - Message handling (add, update, accumulation)
 * - Tool call and result tracking
 * - File updates
 * - Generation state management
 * - Truncation logic
 */

import type {
  FileUpdate,
  GenerationMetrics,
  LLMMessage,
  ToolCall,
  ToolResult,
} from '@gen-fullstack/shared';
import { MAX_MESSAGES } from '@gen-fullstack/shared';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useGenerationStore } from '../generation';

describe('useGenerationStore', () => {
  // Reset store before each test
  beforeEach(() => {
    act(() => {
      useGenerationStore.getState().reset();
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useGenerationStore());

      expect(result.current.messages).toEqual([]);
      expect(result.current.toolCalls).toEqual([]);
      expect(result.current.toolResults).toEqual([]);
      expect(result.current.files).toEqual([]);
      expect(result.current.isGenerating).toBe(false);
      expect(result.current.currentSessionId).toBeNull();
      expect(result.current.metrics).toBeNull();
    });
  });

  describe('Message Management', () => {
    it('should add a new message', () => {
      const { result } = renderHook(() => useGenerationStore());

      const message: LLMMessage = {
        id: 'msg-1',
        role: 'assistant',
        content: 'Hello',
        timestamp: Date.now(),
      };

      act(() => {
        result.current.addMessage(message);
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0]).toEqual(message);
    });

    it('should accumulate content for existing message', () => {
      const { result } = renderHook(() => useGenerationStore());

      const message1: LLMMessage = {
        id: 'msg-1',
        role: 'assistant',
        content: 'Hello',
        timestamp: Date.now(),
      };

      const message2: LLMMessage = {
        id: 'msg-1', // Same ID
        role: 'assistant',
        content: ' world',
        timestamp: Date.now(),
      };

      act(() => {
        result.current.addMessage(message1);
        result.current.addMessage(message2);
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].content).toBe('Hello world');
    });

    it('should update message content directly', () => {
      const { result } = renderHook(() => useGenerationStore());

      const message: LLMMessage = {
        id: 'msg-1',
        role: 'assistant',
        content: 'Original',
        timestamp: Date.now(),
      };

      act(() => {
        result.current.addMessage(message);
        result.current.updateMessage('msg-1', 'Updated content');
      });

      expect(result.current.messages[0].content).toBe('Updated content');
    });

    it('should handle updating non-existent message gracefully', () => {
      const { result } = renderHook(() => useGenerationStore());

      act(() => {
        result.current.updateMessage('non-existent', 'Content');
      });

      expect(result.current.messages).toHaveLength(0);
    });
  });

  describe('Tool Call Management', () => {
    it('should add tool calls', () => {
      const { result } = renderHook(() => useGenerationStore());

      const toolCall: ToolCall = {
        id: 'tool-1',
        name: 'writeFile',
        args: { path: '/test.txt', content: 'hello' },
        timestamp: Date.now(),
      };

      act(() => {
        result.current.addToolCall(toolCall);
      });

      expect(result.current.toolCalls).toHaveLength(1);
      expect(result.current.toolCalls[0]).toEqual(toolCall);
    });

    it('should add multiple tool calls', () => {
      const { result } = renderHook(() => useGenerationStore());

      const toolCall1: ToolCall = {
        id: 'tool-1',
        name: 'writeFile',
        timestamp: Date.now(),
      };

      const toolCall2: ToolCall = {
        id: 'tool-2',
        name: 'readFile',
        timestamp: Date.now(),
      };

      act(() => {
        result.current.addToolCall(toolCall1);
        result.current.addToolCall(toolCall2);
      });

      expect(result.current.toolCalls).toHaveLength(2);
    });
  });

  describe('Tool Result Management', () => {
    it('should add tool results', () => {
      const { result } = renderHook(() => useGenerationStore());

      const toolResult: ToolResult = {
        id: 'result-1',
        toolName: 'writeFile',
        result: 'File written successfully',
        timestamp: Date.now(),
      };

      act(() => {
        result.current.addToolResult(toolResult);
      });

      expect(result.current.toolResults).toHaveLength(1);
      expect(result.current.toolResults[0]).toEqual(toolResult);
    });
  });

  describe('File Management', () => {
    it('should add new files', () => {
      const { result } = renderHook(() => useGenerationStore());

      const file: FileUpdate = {
        path: '/test.txt',
        content: 'hello',
      };

      act(() => {
        result.current.updateFile(file);
      });

      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0]).toEqual(file);
    });

    it('should update existing file by path', () => {
      const { result } = renderHook(() => useGenerationStore());

      const file1: FileUpdate = {
        path: '/test.txt',
        content: 'old content',
      };

      const file2: FileUpdate = {
        path: '/test.txt', // Same path
        content: 'new content',
      };

      act(() => {
        result.current.updateFile(file1);
        result.current.updateFile(file2);
      });

      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0].content).toBe('new content');
    });

    it('should handle multiple different files', () => {
      const { result } = renderHook(() => useGenerationStore());

      const file1: FileUpdate = { path: '/app.tsx', content: 'app' };
      const file2: FileUpdate = { path: '/lib.ts', content: 'lib' };

      act(() => {
        result.current.updateFile(file1);
        result.current.updateFile(file2);
      });

      expect(result.current.files).toHaveLength(2);
    });
  });

  describe('Generation State Management', () => {
    it('should set generating state', () => {
      const { result } = renderHook(() => useGenerationStore());

      act(() => {
        result.current.setGenerating(true);
      });

      expect(result.current.isGenerating).toBe(true);

      act(() => {
        result.current.setGenerating(false);
      });

      expect(result.current.isGenerating).toBe(false);
    });

    it('should set session ID', () => {
      const { result } = renderHook(() => useGenerationStore());

      act(() => {
        result.current.setSessionId('test-session-123');
      });

      expect(result.current.currentSessionId).toBe('test-session-123');
    });

    it('should set metrics', () => {
      const { result } = renderHook(() => useGenerationStore());

      const metrics: GenerationMetrics = {
        strategy: 'naive',
        model: 'gpt-4',
        totalTokens: 1000,
        inputTokens: 500,
        outputTokens: 500,
        cost: 0.05,
        duration: 5000,
        steps: 10,
      };

      act(() => {
        result.current.setMetrics(metrics);
      });

      expect(result.current.metrics).toEqual(metrics);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset all state to initial values', () => {
      const { result } = renderHook(() => useGenerationStore());

      // Populate state
      act(() => {
        result.current.addMessage({
          id: 'msg-1',
          role: 'assistant',
          content: 'Test',
          timestamp: Date.now(),
        });
        result.current.addToolCall({
          id: 'tool-1',
          name: 'writeFile',
          timestamp: Date.now(),
        });
        result.current.setGenerating(true);
        result.current.setSessionId('test-session');
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.isGenerating).toBe(true);

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.messages).toEqual([]);
      expect(result.current.toolCalls).toEqual([]);
      expect(result.current.toolResults).toEqual([]);
      expect(result.current.files).toEqual([]);
      expect(result.current.isGenerating).toBe(false);
      expect(result.current.currentSessionId).toBeNull();
      expect(result.current.metrics).toBeNull();
    });
  });

  describe('Truncation Logic', () => {
    it('should not truncate when under limit', () => {
      const { result } = renderHook(() => useGenerationStore());

      act(() => {
        for (let i = 0; i < 50; i++) {
          result.current.addMessage({
            id: `msg-${i}`,
            role: 'assistant',
            content: `Message ${i}`,
            timestamp: Date.now(),
          });
        }
      });

      const truncation = result.current.checkAndTruncate();

      expect(truncation.truncated).toBe(false);
      expect(result.current.messages).toHaveLength(50);
    });

    it('should truncate messages when exceeding MAX_MESSAGES', () => {
      const { result } = renderHook(() => useGenerationStore());

      act(() => {
        for (let i = 0; i < MAX_MESSAGES + 10; i++) {
          result.current.addMessage({
            id: `msg-${i}`,
            role: 'assistant',
            content: `Message ${i}`,
            timestamp: Date.now(),
          });
        }
      });

      let truncation!: {
        truncated: boolean;
        count: number;
        type: 'messages' | 'toolCalls' | 'toolResults';
      };

      act(() => {
        truncation = result.current.checkAndTruncate();
      });

      expect(truncation.truncated).toBe(true);
      expect(truncation.count).toBe(10);
      expect(truncation.type).toBe('messages');
      expect(result.current.messages).toHaveLength(MAX_MESSAGES);
      // First message should be the 11th one added (first 10 removed)
      expect(result.current.messages[0].id).toBe('msg-10');
    });

    it('should truncate tool calls when exceeding MAX_MESSAGES', () => {
      const { result } = renderHook(() => useGenerationStore());

      act(() => {
        for (let i = 0; i < MAX_MESSAGES + 5; i++) {
          result.current.addToolCall({
            id: `tool-${i}`,
            name: 'writeFile',
            timestamp: Date.now(),
          });
        }
      });

      let truncation!: {
        truncated: boolean;
        count: number;
        type: 'messages' | 'toolCalls' | 'toolResults';
      };

      act(() => {
        truncation = result.current.checkAndTruncate();
      });

      expect(truncation.truncated).toBe(true);
      expect(truncation.count).toBe(5);
      expect(truncation.type).toBe('toolCalls');
      expect(result.current.toolCalls).toHaveLength(MAX_MESSAGES);
      expect(result.current.toolCalls[0].id).toBe('tool-5');
    });

    it('should handle multiple truncation checks', () => {
      const { result } = renderHook(() => useGenerationStore());

      act(() => {
        for (let i = 0; i < MAX_MESSAGES + 20; i++) {
          result.current.addMessage({
            id: `msg-${i}`,
            role: 'assistant',
            content: `Message ${i}`,
            timestamp: Date.now(),
          });
        }
      });

      let truncation1!: {
        truncated: boolean;
        count: number;
        type: 'messages' | 'toolCalls' | 'toolResults';
      };
      let truncation2!: {
        truncated: boolean;
        count: number;
        type: 'messages' | 'toolCalls' | 'toolResults';
      };

      act(() => {
        truncation1 = result.current.checkAndTruncate();
        truncation2 = result.current.checkAndTruncate();
      });

      expect(truncation1.truncated).toBe(true);
      expect(truncation1.count).toBe(20);
      expect(truncation2.truncated).toBe(false); // Already truncated
      expect(result.current.messages).toHaveLength(MAX_MESSAGES);
    });
  });

  describe('Store Isolation', () => {
    it('should maintain independent state across multiple hook calls', () => {
      const { result: result1 } = renderHook(() => useGenerationStore());
      const { result: result2 } = renderHook(() => useGenerationStore());

      act(() => {
        result1.current.addMessage({
          id: 'msg-1',
          role: 'assistant',
          content: 'Test',
          timestamp: Date.now(),
        });
      });

      // Both hooks should see the same state (shared store)
      expect(result1.current.messages).toHaveLength(1);
      expect(result2.current.messages).toHaveLength(1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty content in messages', () => {
      const { result } = renderHook(() => useGenerationStore());

      const message: LLMMessage = {
        id: 'msg-1',
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      };

      act(() => {
        result.current.addMessage(message);
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].content).toBe('');
    });

    it('should handle tool calls without args', () => {
      const { result } = renderHook(() => useGenerationStore());

      const toolCall: ToolCall = {
        id: 'tool-1',
        name: 'listFiles',
        // No args
        timestamp: Date.now(),
      };

      act(() => {
        result.current.addToolCall(toolCall);
      });

      expect(result.current.toolCalls[0].args).toBeUndefined();
    });

    it('should handle rapid state updates', () => {
      const { result } = renderHook(() => useGenerationStore());

      act(() => {
        for (let i = 0; i < 100; i++) {
          result.current.addMessage({
            id: `msg-${i}`,
            role: 'assistant',
            content: `Message ${i}`,
            timestamp: Date.now(),
          });
        }
      });

      expect(result.current.messages).toHaveLength(100);
    });

    it('should handle null session ID', () => {
      const { result } = renderHook(() => useGenerationStore());

      act(() => {
        result.current.setSessionId('test-session');
        result.current.setSessionId(null);
      });

      expect(result.current.currentSessionId).toBeNull();
    });

    it('should handle null metrics', () => {
      const { result } = renderHook(() => useGenerationStore());

      const metrics: GenerationMetrics = {
        totalTokens: 100,
        inputTokens: 50,
        outputTokens: 50,
        cost: 0.01,
        duration: 1000,
        steps: 5,
      };

      act(() => {
        result.current.setMetrics(metrics);
        result.current.setMetrics(null);
      });

      expect(result.current.metrics).toBeNull();
    });
  });
});
