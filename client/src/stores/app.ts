import type { AppInfo, AppLog, BuildEvent } from '@gen-fullstack/shared';
import { MAX_LOGS } from '@gen-fullstack/shared';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { truncateArray } from '../lib/array-utils.js';
import type { Store } from '../lib/store-utils.js';

/**
 * App Execution Store
 *
 * Manages state related to generated app execution:
 * - App status (Docker container state)
 * - Logs from the running app
 * - Build events
 */

interface AppState {
  appStatus: AppInfo | null;
  appLogs: AppLog[];
  buildEvents: BuildEvent[];
  // Track current session to enable session-aware cleanup
  currentSessionId: string | null;
}

interface AppActions {
  setAppStatus: (status: AppInfo | null) => void;
  addAppLog: (log: AppLog) => void;
  addBuildEvent: (event: BuildEvent) => void;
  clearAppLogs: () => void;
  clearBuildEvents: () => void;
  reset: () => void;
  checkAndTruncateLogs: () => { truncated: boolean; count: number };
  // Session-aware cleanup: only resets if switching to a different session
  prepareForSession: (sessionId: string) => void;
}

type AppStore = Store<AppState, AppActions>;

const initialState: AppState = {
  appStatus: null,
  appLogs: [],
  buildEvents: [],
  currentSessionId: null,
};

export const useAppStore = create<AppStore>()(
  devtools(
    immer((set) => ({
      ...initialState,

      setAppStatus: (status) => set({ appStatus: status }),

      addAppLog: (log) =>
        set((state) => {
          state.appLogs.push(log);
        }),

      addBuildEvent: (event) =>
        set((state) => {
          state.buildEvents.push(event);
        }),

      clearAppLogs: () => set({ appLogs: [] }),

      clearBuildEvents: () => set({ buildEvents: [] }),

      reset: () => set(initialState),

      checkAndTruncateLogs: () => {
        // Use single set() call for atomicity - prevents race conditions
        let result = { truncated: false, count: 0 };

        set((draft) => {
          result = truncateArray(draft.appLogs, MAX_LOGS);
        });

        return result;
      },

      prepareForSession: (sessionId) =>
        set((state) => {
          // Only reset if switching between two DIFFERENT non-null sessions
          // This prevents memory leaks while avoiding React Strict Mode cleanup issues
          // null -> sessionId (first session): Just set ID, don't reset (preserves state)
          // sessionId1 -> sessionId2 (different sessions): Reset and set new ID
          // sessionId -> sessionId (same session): No-op
          if (state.currentSessionId !== null && state.currentSessionId !== sessionId) {
            return { ...initialState, currentSessionId: sessionId };
          }
          // First session OR same session, just update the ID
          return { ...state, currentSessionId: sessionId };
        }),
    })),
    { name: 'AppStore' },
  ),
);
