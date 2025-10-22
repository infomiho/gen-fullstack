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
