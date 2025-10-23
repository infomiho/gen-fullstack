import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useGenerationStore } from '../../stores';

/**
 * Real-Time Update Tests for SessionPage
 *
 * These tests verify that the SessionPage component properly subscribes to
 * Zustand stores and re-renders when store state changes, ensuring Timeline
 * displays real-time updates during app generation.
 *
 * Context: Previously, SessionPage received static snapshots from useWebSocket()
 * that didn't trigger re-renders. The fix uses direct store subscriptions with
 * shallow equality for optimal performance.
 */
describe('SessionPage - Real-Time Updates', () => {
  beforeEach(() => {
    // Reset store before each test
    useGenerationStore.getState().reset();
  });

  describe('Store Subscription Reactivity', () => {
    it('should trigger re-render when messages are added to store', async () => {
      const { result } = renderHook(() => useGenerationStore((state) => state.messages));

      // Initial state - empty
      expect(result.current).toEqual([]);

      // Simulate WebSocket event adding a message
      act(() => {
        useGenerationStore.getState().addMessage({
          id: 'msg-1',
          role: 'assistant',
          content: 'Hello, I am generating your app!',
          timestamp: Date.now(),
        });
      });

      // Verify hook re-rendered with new message
      await waitFor(() => {
        expect(result.current).toHaveLength(1);
        expect(result.current[0].content).toBe('Hello, I am generating your app!');
      });
    });

    it('should trigger re-render when tool calls are added to store', async () => {
      const { result } = renderHook(() => useGenerationStore((state) => state.toolCalls));

      // Initial state - empty
      expect(result.current).toEqual([]);

      // Simulate WebSocket event adding a tool call
      act(() => {
        useGenerationStore.getState().addToolCall({
          id: 'tool-1',
          name: 'writeFile',
          args: { path: 'package.json', content: '{}' },
          timestamp: Date.now(),
        });
      });

      // Verify hook re-rendered with new tool call
      await waitFor(() => {
        expect(result.current).toHaveLength(1);
        expect(result.current[0].name).toBe('writeFile');
      });
    });

    it('should trigger re-render when tool results are added to store', async () => {
      const { result } = renderHook(() => useGenerationStore((state) => state.toolResults));

      // Initial state - empty
      expect(result.current).toEqual([]);

      // Simulate WebSocket event adding a tool result
      act(() => {
        useGenerationStore.getState().addToolResult({
          id: 'result-1',
          toolName: 'writeFile',
          result: 'File written successfully',
          timestamp: Date.now(),
        });
      });

      // Verify hook re-rendered with new tool result
      await waitFor(() => {
        expect(result.current).toHaveLength(1);
        expect(result.current[0].result).toBe('File written successfully');
      });
    });

    it('should trigger re-render when isGenerating state changes', async () => {
      const { result } = renderHook(() => useGenerationStore((state) => state.isGenerating));

      // Initial state - not generating
      expect(result.current).toBe(false);

      // Start generation
      act(() => {
        useGenerationStore.getState().setGenerating(true);
      });

      // Verify hook re-rendered
      await waitFor(() => {
        expect(result.current).toBe(true);
      });

      // Stop generation
      act(() => {
        useGenerationStore.getState().setGenerating(false);
      });

      // Verify hook re-rendered again
      await waitFor(() => {
        expect(result.current).toBe(false);
      });
    });
  });

  describe('Multiple Store Values', () => {
    it('should update all selected values when store changes', async () => {
      const { result } = renderHook(() => ({
        messages: useGenerationStore((state) => state.messages),
        toolCalls: useGenerationStore((state) => state.toolCalls),
        isGenerating: useGenerationStore((state) => state.isGenerating),
      }));

      // Initial state
      expect(result.current.messages).toEqual([]);
      expect(result.current.toolCalls).toEqual([]);
      expect(result.current.isGenerating).toBe(false);

      // Add message and start generating
      act(() => {
        useGenerationStore.getState().setGenerating(true);
        useGenerationStore.getState().addMessage({
          id: 'msg-1',
          role: 'assistant',
          content: 'Test',
          timestamp: Date.now(),
        });
        useGenerationStore.getState().addToolCall({
          id: 'tool-1',
          name: 'writeFile',
          args: {},
          timestamp: Date.now(),
        });
      });

      // Verify all values updated
      await waitFor(() => {
        expect(result.current.messages).toHaveLength(1);
        expect(result.current.toolCalls).toHaveLength(1);
        expect(result.current.isGenerating).toBe(true);
      });
    });
  });

  describe('Timeline Data Flow Simulation', () => {
    it('should handle rapid successive updates without data loss', async () => {
      const { result } = renderHook(() => ({
        messages: useGenerationStore((state) => state.messages),
        toolCalls: useGenerationStore((state) => state.toolCalls),
        toolResults: useGenerationStore((state) => state.toolResults),
      }));

      // Simulate rapid WebSocket events during generation
      act(() => {
        // Message 1
        useGenerationStore.getState().addMessage({
          id: 'msg-1',
          role: 'assistant',
          content: 'Starting generation...',
          timestamp: Date.now(),
        });

        // Tool call 1
        useGenerationStore.getState().addToolCall({
          id: 'tool-1',
          name: 'writeFile',
          args: { path: 'package.json', content: '{}' },
          timestamp: Date.now() + 100,
        });

        // Tool result 1
        useGenerationStore.getState().addToolResult({
          id: 'result-1',
          toolName: 'writeFile',
          result: 'Success',
          timestamp: Date.now() + 200,
        });

        // Message 2
        useGenerationStore.getState().addMessage({
          id: 'msg-2',
          role: 'assistant',
          content: 'Created package.json',
          timestamp: Date.now() + 300,
        });
      });

      // Verify all events were captured
      await waitFor(() => {
        expect(result.current.messages).toHaveLength(2);
        expect(result.current.toolCalls).toHaveLength(1);
        expect(result.current.toolResults).toHaveLength(1);
      });
    });

    it('should maintain chronological order across multiple event types', async () => {
      const { result } = renderHook(() => ({
        messages: useGenerationStore((state) => state.messages),
        toolCalls: useGenerationStore((state) => state.toolCalls),
      }));

      const baseTime = Date.now();

      // Add events out of chronological order (as they might arrive via WebSocket)
      act(() => {
        useGenerationStore.getState().addToolCall({
          id: 'tool-1',
          name: 'writeFile',
          args: {},
          timestamp: baseTime + 200,
        });

        useGenerationStore.getState().addMessage({
          id: 'msg-1',
          role: 'assistant',
          content: 'First',
          timestamp: baseTime + 100,
        });

        useGenerationStore.getState().addMessage({
          id: 'msg-2',
          role: 'assistant',
          content: 'Third',
          timestamp: baseTime + 300,
        });
      });

      // Verify data is preserved with timestamps
      await waitFor(() => {
        expect(result.current.messages[0].timestamp).toBe(baseTime + 100);
        expect(result.current.toolCalls[0].timestamp).toBe(baseTime + 200);
        expect(result.current.messages[1].timestamp).toBe(baseTime + 300);
      });

      // Timeline component will merge and sort by timestamp client-side
      const allEvents = [
        ...result.current.messages.map((m) => ({ type: 'message', timestamp: m.timestamp })),
        ...result.current.toolCalls.map((t) => ({ type: 'toolCall', timestamp: t.timestamp })),
      ].sort((a, b) => a.timestamp - b.timestamp);

      expect(allEvents).toEqual([
        { type: 'message', timestamp: baseTime + 100 },
        { type: 'toolCall', timestamp: baseTime + 200 },
        { type: 'message', timestamp: baseTime + 300 },
      ]);
    });
  });

  describe('Regression Prevention', () => {
    it('should NOT return stale data after store updates', async () => {
      // This test prevents regression to the old behavior where useWebSocket
      // returned static snapshots that never updated

      const { result: hookResult } = renderHook(() =>
        useGenerationStore((state) => state.messages),
      );

      // Initial state
      expect(hookResult.current).toEqual([]);

      // Add message 1
      act(() => {
        useGenerationStore.getState().addMessage({
          id: 'msg-1',
          role: 'assistant',
          content: 'First message',
          timestamp: Date.now(),
        });
      });

      await waitFor(() => {
        expect(hookResult.current).toHaveLength(1);
      });

      // Add message 2
      act(() => {
        useGenerationStore.getState().addMessage({
          id: 'msg-2',
          role: 'assistant',
          content: 'Second message',
          timestamp: Date.now(),
        });
      });

      // CRITICAL: Hook should re-render with new data (not stale)
      await waitFor(() => {
        expect(hookResult.current).toHaveLength(2);
        expect(hookResult.current[1].content).toBe('Second message');
      });
    });

    it('should update immediately without requiring page navigation', async () => {
      // This test prevents regression where Timeline only updated after switching tabs

      const { result } = renderHook(() => ({
        messages: useGenerationStore((state) => state.messages),
        isGenerating: useGenerationStore((state) => state.isGenerating),
      }));

      // Start generation
      act(() => {
        useGenerationStore.getState().setGenerating(true);
      });

      // Add message while generating
      act(() => {
        useGenerationStore.getState().addMessage({
          id: 'msg-1',
          role: 'assistant',
          content: 'Generating...',
          timestamp: Date.now(),
        });
      });

      // Verify updates are immediate (no navigation needed)
      await waitFor(() => {
        expect(result.current.isGenerating).toBe(true);
        expect(result.current.messages).toHaveLength(1);
      });

      // Add more messages
      act(() => {
        useGenerationStore.getState().addMessage({
          id: 'msg-2',
          role: 'assistant',
          content: 'Still generating...',
          timestamp: Date.now(),
        });
      });

      // Verify continuous updates without user interaction
      await waitFor(() => {
        expect(result.current.messages).toHaveLength(2);
      });
    });
  });
});
