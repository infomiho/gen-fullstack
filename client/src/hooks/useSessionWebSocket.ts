import { useEffect, useState } from 'react';
import type { useWebSocket } from './useWebSocket';

/**
 * Hook to manage WebSocket subscription for a session
 *
 * Handles:
 * - Subscribe to session events when connected
 * - Request app status on subscribe
 * - Auto-resubscribe on reconnection
 * - Track subscription state
 *
 * @param socket - WebSocket socket instance
 * @param sessionId - Session ID to subscribe to
 * @returns Whether the session is currently subscribed
 */
export function useSessionWebSocket(
  socket: ReturnType<typeof useWebSocket>['socket'],
  sessionId: string | undefined,
): boolean {
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (!socket || !sessionId) {
      setIsSubscribed(false);
      return;
    }

    const subscribeToSession = () => {
      setIsSubscribed(true);
      socket.emit('subscribe_to_session', { sessionId });
      socket.emit('get_app_status', { sessionId });
    };

    if (socket.connected) {
      subscribeToSession();
    }

    const handleReconnect = () => {
      subscribeToSession();
    };

    const handleDisconnect = () => {
      setIsSubscribed(false);
    };

    socket.on('connect', handleReconnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('connect', handleReconnect);
      socket.off('disconnect', handleDisconnect);
      setIsSubscribed(false);
    };
  }, [socket, sessionId]);

  return isSubscribed;
}
