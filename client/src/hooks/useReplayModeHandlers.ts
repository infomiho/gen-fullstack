import { useCallback } from 'react';
import { useReplayStore } from '../stores/replay.store';

const SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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
  sessionStatus: 'generating' | 'completed' | 'failed',
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
      const response = await fetch(`${SERVER_URL}/api/sessions/${sessionId}/replay-data`);

      if (!response.ok) {
        throw new Error(`Failed to load replay data: ${response.statusText}`);
      }

      const data = await response.json();
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
