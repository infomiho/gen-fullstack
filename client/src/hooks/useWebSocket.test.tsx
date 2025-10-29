import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGenerationStore } from '../stores';
import { useWebSocket } from './useWebSocket';

// Mock Socket.IO client
vi.mock('socket.io-client', () => {
  const mockSocket = {
    connected: true,
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  };

  return {
    io: vi.fn(() => mockSocket),
  };
});

// Mock ToastProvider
vi.mock('../components/ToastProvider', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

// Mock useDebouncedNotification
vi.mock('./useDebouncedNotification', () => ({
  useDebouncedNotification: () => vi.fn(),
}));

describe('useWebSocket - Navigation Fix', () => {
  beforeEach(() => {
    // Reset generation store before each test
    useGenerationStore.getState().reset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should navigate to session page when session_started fires and navigate function is provided', async () => {
    const mockNavigate = vi.fn();

    // Render hook with navigate function
    const { result } = renderHook(() => useWebSocket(mockNavigate));

    // Wait for socket to be set up
    await waitFor(() => {
      expect(result.current.socket).toBeTruthy();
    });

    // Get the session_started handler that was registered
    const socket = result.current.socket;
    expect(socket).toBeTruthy();
    const onCalls = (socket?.on as ReturnType<typeof vi.fn>).mock.calls;
    const sessionStartedHandler = onCalls.find((call) => call[0] === 'session_started')?.[1];

    expect(sessionStartedHandler).toBeDefined();

    // Simulate session_started event (wrap in act since it triggers state updates)
    await act(async () => {
      sessionStartedHandler({ sessionId: 'test-session-123' });
    });

    // Verify navigation was called
    expect(mockNavigate).toHaveBeenCalledWith('/test-session-123');
  });

  it('should not navigate when navigate function is not provided', async () => {
    // Render hook WITHOUT navigate function
    const { result } = renderHook(() => useWebSocket());

    // Wait for socket to be set up
    await waitFor(() => {
      expect(result.current.socket).toBeTruthy();
    });

    // Get the session_started handler that was registered
    const socket = result.current.socket;
    expect(socket).toBeTruthy();
    const onCalls = (socket?.on as ReturnType<typeof vi.fn>).mock.calls;
    const sessionStartedHandler = onCalls.find((call) => call[0] === 'session_started')?.[1];

    expect(sessionStartedHandler).toBeDefined();

    // Simulate session_started event (wrap in act since it triggers state updates)
    await act(async () => {
      sessionStartedHandler({ sessionId: 'test-session-456' });
    });

    // No navigation should have occurred (this is the default behavior for SessionPage)
  });

  it('should not cause navigation loop when mounting HomePage', async () => {
    const mockNavigate = vi.fn();

    // Mount HomePage (simulated by rendering hook with navigate)
    renderHook(() => useWebSocket(mockNavigate));

    // Wait a bit to ensure no navigation triggers
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Navigation should NOT be called on mount
    // It should only be called when session_started event fires
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe('useWebSocket - Auto-start Behavior (Issue #75)', () => {
  beforeEach(() => {
    useGenerationStore.getState().reset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should auto-start app when generation completes successfully', async () => {
    const { result } = renderHook(() => useWebSocket());

    // Wait for socket to be set up (before enabling fake timers)
    await waitFor(() => {
      expect(result.current.socket).toBeTruthy();
    });

    // Now enable fake timers for the setTimeout test
    vi.useFakeTimers();

    const socket = result.current.socket;
    expect(socket).toBeTruthy();
    const onCalls = (socket?.on as ReturnType<typeof vi.fn>).mock.calls;
    const generationCompleteHandler = onCalls.find(
      (call) => call[0] === 'generation_complete',
    )?.[1];

    expect(generationCompleteHandler).toBeDefined();

    // Simulate successful generation
    await act(async () => {
      generationCompleteHandler({
        sessionId: 'test-session-123',
        model: 'gpt-4',
        status: 'completed',
        totalTokens: 1000,
        inputTokens: 500,
        outputTokens: 500,
        cost: 0.05,
        duration: 5000,
        steps: 3,
      });
    });

    // Fast-forward timers to trigger auto-start
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Verify start_app was emitted
    const emitCalls = (socket?.emit as ReturnType<typeof vi.fn>).mock.calls;
    const startAppCall = emitCalls.find((call) => call[0] === 'start_app');
    expect(startAppCall).toBeDefined();
    expect(startAppCall?.[1]).toEqual({ sessionId: 'test-session-123' });

    vi.useRealTimers();
  });

  it('should NOT auto-start app when generation fails', async () => {
    const { result } = renderHook(() => useWebSocket());

    // Wait for socket to be set up (before enabling fake timers)
    await waitFor(() => {
      expect(result.current.socket).toBeTruthy();
    });

    // Now enable fake timers for the setTimeout test
    vi.useFakeTimers();

    const socket = result.current.socket;
    expect(socket).toBeTruthy();
    const onCalls = (socket?.on as ReturnType<typeof vi.fn>).mock.calls;
    const generationCompleteHandler = onCalls.find(
      (call) => call[0] === 'generation_complete',
    )?.[1];

    expect(generationCompleteHandler).toBeDefined();

    // Simulate failed generation
    await act(async () => {
      generationCompleteHandler({
        sessionId: 'test-session-456',
        model: 'gpt-4',
        status: 'failed',
        totalTokens: 500,
        inputTokens: 300,
        outputTokens: 200,
        cost: 0.02,
        duration: 2000,
        steps: 1,
      });
    });

    // Fast-forward timers
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Verify start_app was NOT emitted
    const emitCalls = (socket?.emit as ReturnType<typeof vi.fn>).mock.calls;
    const startAppCall = emitCalls.find((call) => call[0] === 'start_app');
    expect(startAppCall).toBeUndefined();

    vi.useRealTimers();
  });

  it('should NOT auto-start app when generation is cancelled', async () => {
    const { result } = renderHook(() => useWebSocket());

    // Wait for socket to be set up (before enabling fake timers)
    await waitFor(() => {
      expect(result.current.socket).toBeTruthy();
    });

    // Now enable fake timers for the setTimeout test
    vi.useFakeTimers();

    const socket = result.current.socket;
    expect(socket).toBeTruthy();
    const onCalls = (socket?.on as ReturnType<typeof vi.fn>).mock.calls;
    const generationCompleteHandler = onCalls.find(
      (call) => call[0] === 'generation_complete',
    )?.[1];

    expect(generationCompleteHandler).toBeDefined();

    // Simulate cancelled generation
    await act(async () => {
      generationCompleteHandler({
        sessionId: 'test-session-789',
        model: 'gpt-4',
        status: 'cancelled',
        totalTokens: 200,
        inputTokens: 100,
        outputTokens: 100,
        cost: 0.01,
        duration: 1000,
        steps: 1,
      });
    });

    // Fast-forward timers
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Verify start_app was NOT emitted
    const emitCalls = (socket?.emit as ReturnType<typeof vi.fn>).mock.calls;
    const startAppCall = emitCalls.find((call) => call[0] === 'start_app');
    expect(startAppCall).toBeUndefined();

    vi.useRealTimers();
  });
});
