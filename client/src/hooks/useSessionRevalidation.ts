import { useEffect, useRef } from 'react';
import { useRevalidator } from 'react-router';
import type { Socket } from 'socket.io-client';
import type { GenerationMetrics } from '@gen-fullstack/shared';

/**
 * Custom hook to revalidate session data when generation completes
 *
 * Listens to the 'generation_complete' WebSocket event and triggers
 * a revalidation of the session loader data to ensure the UI displays
 * the updated session status.
 *
 * Includes protection against:
 * - Race conditions with database commits (100ms delay)
 * - React StrictMode double-revalidation
 * - Cross-session revalidation when navigating between sessions
 *
 * @param socket - Socket.IO client instance
 * @param sessionId - Current session ID
 * @param isSubscribed - Whether we're subscribed to this session's events
 */
export function useSessionRevalidation(
  socket: Socket | null,
  sessionId: string | undefined,
  isSubscribed: boolean,
) {
  const revalidator = useRevalidator();
  const hasRevalidatedRef = useRef(false);

  useEffect(() => {
    if (!socket || !sessionId || !isSubscribed) return;

    const handleGenerationComplete = (metrics: GenerationMetrics) => {
      // Only revalidate if completion is for this session
      if (metrics.sessionId !== sessionId) return;

      // Prevent double-revalidation in React StrictMode
      if (hasRevalidatedRef.current) return;
      hasRevalidatedRef.current = true;

      // Small delay to ensure database transaction has committed
      // SQLite in WAL mode needs time to sync writes
      setTimeout(() => {
        revalidator.revalidate();

        // Reset flag after revalidation completes
        setTimeout(() => {
          hasRevalidatedRef.current = false;
        }, 1000);
      }, 100);
    };

    socket.on('generation_complete', handleGenerationComplete);

    return () => {
      socket.off('generation_complete', handleGenerationComplete);
    };
  }, [socket, sessionId, isSubscribed, revalidator]);
}
