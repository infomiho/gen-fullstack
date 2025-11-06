/**
 * Tests for useSessionData hook - Live Updates
 *
 * Tests that verify the hook correctly re-renders when WebSocket data updates
 */

import type { FileUpdate, LLMMessage } from '@gen-fullstack/shared';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createMockTimelineItem } from '../__tests__/test-helpers';
import { useSessionData } from './useSessionData';

describe('useSessionData - Live Updates', () => {
  it('should re-render when live WebSocket messages update', async () => {
    const persistedTimeline = [
      createMockTimelineItem({
        id: 1,
        sessionId: 'test-session',
        timestamp: new Date('2024-01-01T10:00:00Z'),
        type: 'message' as const,
        messageId: 'msg-1',
        role: 'system' as const,
        content: 'Starting generation...',
      }),
    ];

    // Initial render with no live data
    const { result, rerender } = renderHook(
      ({ liveMessages }) =>
        useSessionData({
          timeline: persistedTimeline,
          persistedFiles: [],
          liveMessages: liveMessages,
          liveToolCalls: [],
          liveToolResults: [],
          livePipelineStages: [],
          liveFiles: [],
          isActiveSession: true,
          isConnectedToRoom: true,
        }),
      {
        initialProps: { liveMessages: [] as LLMMessage[] },
      },
    );

    // Initial render should show only persisted message
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].content).toBe('Starting generation...');

    // Re-render with new live messages
    const newLiveMessages: LLMMessage[] = [
      {
        id: 'msg-2',
        role: 'assistant' as const,
        content: 'Creating files...',
        timestamp: Date.parse('2024-01-01T10:00:01Z'),
      },
    ];

    rerender({ liveMessages: newLiveMessages });

    // Should now have 2 messages (1 persisted + 1 live)
    await waitFor(() => {
      expect(result.current.messages).toHaveLength(2);
    });

    expect(result.current.messages[0].content).toBe('Starting generation...');
    expect(result.current.messages[1].content).toBe('Creating files...');
  });

  it('should re-render when live WebSocket files update', async () => {
    const persistedFiles = [
      {
        id: 1,
        sessionId: 'test-session',
        path: '/package.json',
        content: '{"name": "test"}',
        createdAt: new Date('2024-01-01T10:00:00Z'),
        updatedAt: new Date('2024-01-01T10:00:00Z'),
      },
    ];

    // Initial render with no live files
    const { result, rerender } = renderHook(
      ({ liveFiles }) =>
        useSessionData({
          timeline: [],
          persistedFiles: persistedFiles,
          liveMessages: [],
          liveToolCalls: [],
          liveToolResults: [],
          livePipelineStages: [],
          liveFiles: liveFiles,
          isActiveSession: true,
          isConnectedToRoom: true,
        }),
      {
        initialProps: { liveFiles: [] as FileUpdate[] },
      },
    );

    // Initial render should show only persisted file
    expect(result.current.files).toHaveLength(1);
    expect(result.current.files[0].path).toBe('/package.json');

    // Re-render with new live files
    const newLiveFiles: FileUpdate[] = [
      {
        path: '/src/App.tsx',
        content: 'export default function App() {}',
      },
    ];

    rerender({ liveFiles: newLiveFiles });

    // Should now have 2 files (1 persisted + 1 live)
    await waitFor(() => {
      expect(result.current.files).toHaveLength(2);
    });

    const filePaths = result.current.files.map((f) => f.path).sort();
    expect(filePaths).toEqual(['/package.json', '/src/App.tsx']);
  });

  it('should accept WebSocket data as parameters (verifies the fix)', () => {
    // This test verifies the fix: useSessionData accepts WebSocket data as parameters
    // instead of calling useWebSocket internally

    const persistedTimeline = [
      createMockTimelineItem({
        id: 1,
        sessionId: 'test-session',
        timestamp: new Date('2024-01-01T10:00:00Z'),
        type: 'message' as const,
        messageId: 'msg-1',
        role: 'system' as const,
        content: 'Persisted',
      }),
    ];

    const liveMessages: LLMMessage[] = [
      {
        id: 'msg-2',
        role: 'assistant' as const,
        content: 'Live',
        timestamp: Date.parse('2024-01-01T10:00:01Z'),
      },
    ];

    // Render the hook with explicit parameters
    const { result } = renderHook(() =>
      useSessionData({
        timeline: persistedTimeline,
        persistedFiles: [],
        liveMessages: liveMessages,
        liveToolCalls: [],
        liveToolResults: [],
        livePipelineStages: [],
        liveFiles: [],
        isActiveSession: true,
        isConnectedToRoom: true,
      }),
    );

    // Should merge both persisted and live data
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].content).toBe('Persisted');
    expect(result.current.messages[1].content).toBe('Live');

    // This prevents the issue where SessionPage and useSessionData
    // each created their own WebSocket connection
  });
});
