import { useEffect } from 'react';
import type { Socket } from 'socket.io-client';
import { useAppStore, useGenerationStore } from '../stores';
import { useReplayStore } from '../stores/replay.store';
import { useSessionRevalidation } from './useSessionRevalidation';
import { useDisconnectionToast } from './useDisconnectionToast';

/**
 * Custom hook for session lifecycle management
 *
 * Handles:
 * - Store preparation when switching sessions
 * - Exiting replay mode when viewing different session
 * - Session revalidation on completion
 * - Disconnection toast notifications
 */
export function useSessionLifecycle(
  sessionId: string | undefined,
  socket: Socket | null,
  isSubscribed: boolean,
  isConnected: boolean,
  isActiveSession: boolean,
  showToast: (
    title: string,
    description?: string,
    type?: 'success' | 'error' | 'info' | 'warning',
  ) => void,
) {
  const { exitReplayMode } = useReplayStore();

  // Prepare stores for this session (cleanup if switching sessions)
  useEffect(() => {
    if (!sessionId) return;

    useGenerationStore.getState().prepareForSession(sessionId);
    useAppStore.getState().prepareForSession(sessionId);
  }, [sessionId]);

  // Exit replay mode if viewing a different session
  useEffect(() => {
    const replayState = useReplayStore.getState();
    const isDifferentSession = replayState.isReplayMode && replayState.sessionId !== sessionId;
    if (isDifferentSession) {
      exitReplayMode();
    }
  }, [sessionId, exitReplayMode]);

  // Revalidate loader data when generation completes
  const isSubscribedSession = socket !== null && isSubscribed;
  useSessionRevalidation(socket, sessionId, isSubscribedSession);

  // Show disconnection toast
  useDisconnectionToast(isConnected, isActiveSession, showToast);
}
