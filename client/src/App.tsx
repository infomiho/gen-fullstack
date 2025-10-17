import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './router';
import { useConnectionStore } from './stores';

/**
 * Root App Component
 *
 * Handles app-level lifecycle management including socket cleanup on unmount.
 */
export function App() {
  // Cleanup socket on app unmount (e.g., browser tab close)
  useEffect(() => {
    return () => {
      const socket = useConnectionStore.getState().socket;
      if (socket) {
        socket.close();
        useConnectionStore.getState().setSocket(null);
      }
    };
  }, []);

  return <RouterProvider router={router} />;
}
