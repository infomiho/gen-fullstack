/**
 * Tests for useSessionData hook
 *
 * Verifies correct data conversion and merging between persisted and live WebSocket data
 */

import type { FileUpdate, LLMMessage } from '@gen-fullstack/shared';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useSessionData } from './useSessionData';

describe('useSessionData', () => {
  describe('Data Conversion - Persisted to Client Format', () => {
    it('should convert persisted messages to client format', () => {
      const persistedTimeline = [
        {
          id: 1,
          sessionId: 'test-session',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          type: 'message' as const,
          messageId: 'msg-1',
          role: 'system' as const,
          content: 'Starting generation...',
          isError: false,
        },
      ];

      const { result } = renderHook(() =>
        useSessionData({
          timeline: persistedTimeline,
          persistedFiles: [],
          liveMessages: [],
          liveToolCalls: [],
          liveToolResults: [],
          liveFiles: [],
          isActiveSession: false,
          isConnectedToRoom: false,
        }),
      );

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0]).toEqual({
        id: 'msg-1', // Uses messageId from database
        role: 'system',
        content: 'Starting generation...',
        timestamp: Date.parse('2024-01-01T10:00:00Z'),
      });
    });

    it('should convert persisted tool calls to client format', () => {
      const persistedTimeline = [
        {
          id: 1,
          sessionId: 'test-session',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          type: 'tool_call' as const,
          toolCallId: 'tool-1',
          toolName: 'writeFile',
          toolArgs: '{"path":"/test.txt","content":"hello"}',
          isError: false,
        },
      ];

      const { result } = renderHook(() =>
        useSessionData({
          timeline: persistedTimeline,
          persistedFiles: [],
          liveMessages: [],
          liveToolCalls: [],
          liveToolResults: [],
          liveFiles: [],
          isActiveSession: false,
          isConnectedToRoom: false,
        }),
      );

      expect(result.current.toolCalls).toHaveLength(1);
      expect(result.current.toolCalls[0]).toEqual({
        id: 'tool-1',
        name: 'writeFile',
        args: { path: '/test.txt', content: 'hello' },
        timestamp: Date.parse('2024-01-01T10:00:00Z'),
      });
    });

    it('should convert persisted tool results to client format', () => {
      const persistedTimeline = [
        {
          id: 1,
          sessionId: 'test-session',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          type: 'tool_result' as const,
          toolResultId: 'result-1',
          toolResultFor: 'tool-1',
          toolName: 'writeFile',
          result: 'File written successfully',
          isError: false,
        },
      ];

      const { result } = renderHook(() =>
        useSessionData({
          timeline: persistedTimeline,
          persistedFiles: [],
          liveMessages: [],
          liveToolCalls: [],
          liveToolResults: [],
          liveFiles: [],
          isActiveSession: false,
          isConnectedToRoom: false,
        }),
      );

      expect(result.current.toolResults).toHaveLength(1);
      expect(result.current.toolResults[0]).toEqual({
        id: 'result-1',
        toolName: 'writeFile',
        result: 'File written successfully',
        timestamp: Date.parse('2024-01-01T10:00:00Z'),
      });
    });

    it('should convert persisted files to client format', () => {
      const persistedFiles = [
        {
          id: 1,
          sessionId: 'test-session',
          path: '/test.txt',
          content: 'hello',
          createdAt: new Date('2024-01-01T10:00:00Z'),
          updatedAt: new Date('2024-01-01T10:00:00Z'),
        },
      ];

      const { result } = renderHook(() =>
        useSessionData({
          timeline: [],
          persistedFiles: persistedFiles,
          liveMessages: [],
          liveToolCalls: [],
          liveToolResults: [],
          liveFiles: [],
          isActiveSession: false,
          isConnectedToRoom: false,
        }),
      );

      expect(result.current.files).toHaveLength(1);
      expect(result.current.files[0]).toEqual({
        path: '/test.txt',
        content: 'hello',
      });
    });
  });

  describe('Data Merging - Active Session', () => {
    it('should merge persisted and live messages when isConnectedToRoom=true', () => {
      const persistedTimeline = [
        {
          id: 1,
          sessionId: 'test-session',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          type: 'message' as const,
          messageId: 'msg-1',
          role: 'system' as const,
          content: 'Starting...',
          isError: false,
        },
      ];

      const liveMessages: LLMMessage[] = [
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Creating files...',
          timestamp: Date.parse('2024-01-01T10:00:01Z'),
        },
      ];

      const { result } = renderHook(() =>
        useSessionData({
          timeline: persistedTimeline,
          persistedFiles: [],
          liveMessages: liveMessages,
          liveToolCalls: [],
          liveToolResults: [],
          liveFiles: [],
          isActiveSession: true,
          isConnectedToRoom: true,
        }),
      );

      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0].content).toBe('Starting...');
      expect(result.current.messages[1].content).toBe('Creating files...');
    });

    it('should NOT merge when isActiveSession=false', () => {
      const persistedTimeline = [
        {
          id: 1,
          sessionId: 'test-session',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          type: 'message' as const,
          messageId: 'msg-1',
          role: 'system' as const,
          content: 'Persisted',
          isError: false,
        },
      ];

      const liveMessages: LLMMessage[] = [
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Live',
          timestamp: Date.parse('2024-01-01T10:00:01Z'),
        },
      ];

      const { result } = renderHook(() =>
        useSessionData({
          timeline: persistedTimeline,
          persistedFiles: [],
          liveMessages: liveMessages,
          liveToolCalls: [],
          liveToolResults: [],
          liveFiles: [],
          isActiveSession: false,
          isConnectedToRoom: false,
        }),
      );

      // Should only show persisted data
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].content).toBe('Persisted');
    });

    it('should NOT merge when isOwnSession=false', () => {
      const persistedTimeline = [
        {
          id: 1,
          sessionId: 'test-session',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          type: 'message' as const,
          messageId: 'msg-1',
          role: 'system' as const,
          content: 'Persisted',
          isError: false,
        },
      ];

      const liveMessages: LLMMessage[] = [
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Live',
          timestamp: Date.parse('2024-01-01T10:00:01Z'),
        },
      ];

      const { result } = renderHook(() =>
        useSessionData({
          timeline: persistedTimeline,
          persistedFiles: [],
          liveMessages: liveMessages,
          liveToolCalls: [],
          liveToolResults: [],
          liveFiles: [],
          isActiveSession: true,
          isConnectedToRoom: false,
        }),
      );

      // Should only show persisted data (not our session)
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].content).toBe('Persisted');
    });
  });

  describe('Data Deduplication', () => {
    it('should deduplicate messages by ID when merging', () => {
      const persistedTimeline = [
        {
          id: 1,
          sessionId: 'test-session',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          type: 'message' as const,
          messageId: 'msg-1',
          role: 'system' as const,
          content: 'Persisted content',
          isError: false,
        },
      ];

      const liveMessages: LLMMessage[] = [
        {
          id: 'msg-1', // Same ID as persisted messageId
          role: 'system',
          content: 'Live content (should override)',
          timestamp: Date.parse('2024-01-01T10:00:00Z'),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'New message',
          timestamp: Date.parse('2024-01-01T10:00:01Z'),
        },
      ];

      const { result } = renderHook(() =>
        useSessionData({
          timeline: persistedTimeline,
          persistedFiles: [],
          liveMessages: liveMessages,
          liveToolCalls: [],
          liveToolResults: [],
          liveFiles: [],
          isActiveSession: true,
          isConnectedToRoom: true,
        }),
      );

      // Should deduplicate - only 2 unique messages
      expect(result.current.messages).toHaveLength(2);
      // Live data should win in the merge
      expect(result.current.messages[0].content).toBe('Live content (should override)');
      expect(result.current.messages[1].content).toBe('New message');
    });

    it('should deduplicate files by path when merging', () => {
      const persistedFiles = [
        {
          id: 1,
          sessionId: 'test-session',
          path: '/test.txt',
          content: 'old content',
          createdAt: new Date('2024-01-01T10:00:00Z'),
          updatedAt: new Date('2024-01-01T10:00:00Z'),
        },
      ];

      const liveFiles: FileUpdate[] = [
        {
          path: '/test.txt', // Same path
          content: 'new content',
        },
        {
          path: '/app.tsx',
          content: 'export default App',
        },
      ];

      const { result } = renderHook(() =>
        useSessionData({
          timeline: [],
          persistedFiles: persistedFiles,
          liveMessages: [],
          liveToolCalls: [],
          liveToolResults: [],
          liveFiles: liveFiles,
          isActiveSession: true,
          isConnectedToRoom: true,
        }),
      );

      // Should have 2 files (deduplicated by path)
      expect(result.current.files).toHaveLength(2);

      const testFile = result.current.files.find((f) => f.path === '/test.txt');
      expect(testFile?.content).toBe('new content'); // Live wins
    });
  });

  describe('Data Sorting', () => {
    it('should sort merged messages by timestamp', () => {
      const persistedTimeline = [
        {
          id: 1,
          sessionId: 'test-session',
          timestamp: new Date('2024-01-01T10:00:02Z'), // Later
          type: 'message' as const,
          messageId: 'msg-1',
          role: 'system' as const,
          content: 'Third',
          isError: false,
        },
      ];

      const liveMessages: LLMMessage[] = [
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'First',
          timestamp: Date.parse('2024-01-01T10:00:00Z'), // Earliest
        },
        {
          id: 'msg-3',
          role: 'assistant',
          content: 'Second',
          timestamp: Date.parse('2024-01-01T10:00:01Z'), // Middle
        },
      ];

      const { result } = renderHook(() =>
        useSessionData({
          timeline: persistedTimeline,
          persistedFiles: [],
          liveMessages: liveMessages,
          liveToolCalls: [],
          liveToolResults: [],
          liveFiles: [],
          isActiveSession: true,
          isConnectedToRoom: true,
        }),
      );

      expect(result.current.messages).toHaveLength(3);
      expect(result.current.messages[0].content).toBe('First');
      expect(result.current.messages[1].content).toBe('Second');
      expect(result.current.messages[2].content).toBe('Third');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty persisted data', () => {
      const { result } = renderHook(() =>
        useSessionData({
          timeline: [],
          persistedFiles: [],
          liveMessages: [],
          liveToolCalls: [],
          liveToolResults: [],
          liveFiles: [],
          isActiveSession: false,
          isConnectedToRoom: false,
        }),
      );

      expect(result.current.messages).toHaveLength(0);
      expect(result.current.toolCalls).toHaveLength(0);
      expect(result.current.toolResults).toHaveLength(0);
      expect(result.current.files).toHaveLength(0);
    });

    it('should handle malformed JSON in tool args', () => {
      const persistedTimeline = [
        {
          id: 1,
          sessionId: 'test-session',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          type: 'tool_call' as const,
          toolCallId: 'tool-1',
          toolName: 'writeFile',
          toolArgs: 'invalid json{{{',
          isError: false,
        },
      ];

      const { result } = renderHook(() =>
        useSessionData({
          timeline: persistedTimeline,
          persistedFiles: [],
          liveMessages: [],
          liveToolCalls: [],
          liveToolResults: [],
          liveFiles: [],
          isActiveSession: false,
          isConnectedToRoom: false,
        }),
      );

      expect(result.current.toolCalls).toHaveLength(1);
      expect(result.current.toolCalls[0].args).toEqual({}); // Falls back to empty object
    });

    it('should handle null toolArgs', () => {
      const persistedTimeline = [
        {
          id: 1,
          sessionId: 'test-session',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          type: 'tool_call' as const,
          toolCallId: 'tool-1',
          toolName: 'writeFile',
          toolArgs: null as any,
          isError: false,
        },
      ];

      const { result } = renderHook(() =>
        useSessionData({
          timeline: persistedTimeline,
          persistedFiles: [],
          liveMessages: [],
          liveToolCalls: [],
          liveToolResults: [],
          liveFiles: [],
          isActiveSession: false,
          isConnectedToRoom: false,
        }),
      );

      expect(result.current.toolCalls).toHaveLength(1);
      expect(result.current.toolCalls[0].args).toEqual({});
    });

    it('should handle empty string result in tool results', () => {
      const persistedTimeline = [
        {
          id: 1,
          sessionId: 'test-session',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          type: 'tool_result' as const,
          toolResultId: 'result-1',
          toolResultFor: 'tool-1',
          toolName: 'writeFile',
          result: '',
          isError: false,
        },
      ];

      const { result } = renderHook(() =>
        useSessionData({
          timeline: persistedTimeline,
          persistedFiles: [],
          liveMessages: [],
          liveToolCalls: [],
          liveToolResults: [],
          liveFiles: [],
          isActiveSession: false,
          isConnectedToRoom: false,
        }),
      );

      expect(result.current.toolResults).toHaveLength(1);
      expect(result.current.toolResults[0].result).toBe('');
    });

    it('should handle null result in tool results', () => {
      const persistedTimeline = [
        {
          id: 1,
          sessionId: 'test-session',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          type: 'tool_result' as const,
          toolResultId: 'result-1',
          toolResultFor: 'tool-1',
          toolName: 'writeFile',
          result: null as any,
          isError: false,
        },
      ];

      const { result } = renderHook(() =>
        useSessionData({
          timeline: persistedTimeline,
          persistedFiles: [],
          liveMessages: [],
          liveToolCalls: [],
          liveToolResults: [],
          liveFiles: [],
          isActiveSession: false,
          isConnectedToRoom: false,
        }),
      );

      expect(result.current.toolResults).toHaveLength(1);
      // Converted to empty string
      expect(result.current.toolResults[0].result).toBe('');
    });

    it('should filter out invalid timeline items', () => {
      const persistedTimeline = [
        {
          id: 1,
          sessionId: 'test-session',
          timestamp: new Date('2024-01-01T10:00:00Z'),
          type: 'message' as const,
          messageId: 'msg-1',
          role: 'system' as const,
          content: 'Valid',
          isError: false,
        },
        {
          id: 2,
          sessionId: 'test-session',
          timestamp: new Date('2024-01-01T10:00:01Z'),
          type: 'message' as const,
          // Missing role and content - should be filtered out
          isError: false,
        } as any,
        {
          id: 3,
          sessionId: 'test-session',
          timestamp: new Date('2024-01-01T10:00:02Z'),
          type: 'message' as const,
          messageId: 'msg-3',
          role: 'assistant' as const,
          content: 'Also valid',
          isError: false,
        },
      ];

      const { result } = renderHook(() =>
        useSessionData({
          timeline: persistedTimeline,
          persistedFiles: [],
          liveMessages: [],
          liveToolCalls: [],
          liveToolResults: [],
          liveFiles: [],
          isActiveSession: false,
          isConnectedToRoom: false,
        }),
      );

      // Should only have 2 valid messages
      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0].content).toBe('Valid');
      expect(result.current.messages[1].content).toBe('Also valid');
    });
  });
});
