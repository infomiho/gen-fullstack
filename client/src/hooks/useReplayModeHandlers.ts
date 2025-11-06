import { useCallback } from 'react';
import { useReplayStore } from '../stores/replay.store';
import { orpc } from '../lib/orpc';

/**
 * Custom hook for replay mode handlers
 *
 * Encapsulates all replay mode logic:
 * - Entering replay mode (fetch + validation)
 * - Exiting replay mode
 * - Error handling
 */
export function useReplayModeHandlers(
  sessionId: string | undefined,
  sessionStatus: 'pending' | 'generating' | 'completed' | 'failed' | 'cancelled',
  showToast: (
    title: string,
    description?: string,
    type?: 'success' | 'error' | 'info' | 'warning',
  ) => void,
) {
  const { exitReplayMode, enterReplayMode: enterReplay } = useReplayStore();

  const handleEnterReplayMode = useCallback(async () => {
    if (!sessionId) return;

    // Only allow replay for completed or failed sessions
    if (sessionStatus === 'generating') {
      showToast('Cannot replay', 'Cannot replay session that is still generating', 'error');
      return;
    }

    try {
      const data = await orpc.sessions.getReplayData({ sessionId });
      enterReplay(sessionId, data);
    } catch (_error) {
      showToast('Error', 'Failed to load replay data', 'error');
    }
  }, [sessionId, sessionStatus, enterReplay, showToast]);

  const handleExitReplayMode = useCallback(() => {
    exitReplayMode();
  }, [exitReplayMode]);

  return {
    handleEnterReplayMode,
    handleExitReplayMode,
  };
}
