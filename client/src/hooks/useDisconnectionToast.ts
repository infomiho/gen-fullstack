import { useEffect, useRef } from 'react';

/**
 * Custom hook for disconnection toast notifications
 *
 * Shows a toast when connection is lost during an active session.
 * Uses a ref to track previous connection state to avoid showing
 * the toast on initial mount.
 */
export function useDisconnectionToast(
  isConnected: boolean,
  isActiveSession: boolean,
  showToast: (
    title: string,
    description?: string,
    type?: 'success' | 'error' | 'info' | 'warning',
  ) => void,
) {
  const previouslyConnectedRef = useRef(false);

  useEffect(() => {
    if (previouslyConnectedRef.current && !isConnected && isActiveSession) {
      showToast('Connection lost', 'Attempting to reconnect...', 'warning');
    }
    previouslyConnectedRef.current = isConnected;
  }, [isConnected, isActiveSession, showToast]);
}
