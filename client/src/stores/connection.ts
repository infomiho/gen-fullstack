import type { Socket } from 'socket.io-client';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Store } from '../lib/store-utils.js';

/**
 * Connection Store
 *
 * Manages WebSocket connection state:
 * - Socket instance
 * - Connection status
 */

interface ConnectionState {
  socket: Socket | null;
  isConnected: boolean;
}

interface ConnectionActions {
  setSocket: (socket: Socket | null) => void;
  setConnected: (value: boolean) => void;
}

type ConnectionStore = Store<ConnectionState, ConnectionActions>;

const initialState: ConnectionState = {
  socket: null,
  isConnected: false,
};

export const useConnectionStore = create<ConnectionStore>()(
  devtools(
    (set) => ({
      ...initialState,

      setSocket: (socket) => set({ socket }),

      setConnected: (value) => set({ isConnected: value }),
    }),
    { name: 'ConnectionStore' },
  ),
);
