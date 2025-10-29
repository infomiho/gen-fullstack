import { useCallback } from 'react';
import { useNavigate } from 'react-router';

/**
 * Custom hook for app execution handlers
 *
 * Encapsulates callbacks for:
 * - Starting app
 * - Stopping app
 * - Navigating to preview
 */
export function useAppExecutionHandlers(
  sessionId: string | undefined,
  startApp: (sessionId: string) => void,
  stopApp: (sessionId: string) => void,
) {
  const navigate = useNavigate();

  const handleStartApp = useCallback(() => {
    if (!sessionId) return;
    startApp(sessionId);
  }, [sessionId, startApp]);

  const handleStopApp = useCallback(() => {
    if (!sessionId) return;
    stopApp(sessionId);
  }, [sessionId, stopApp]);

  const handleStartClick = useCallback(() => {
    if (!sessionId) return;
    navigate(`/${sessionId}/preview`);
  }, [sessionId, navigate]);

  return {
    handleStartApp,
    handleStopApp,
    handleStartClick,
  };
}
