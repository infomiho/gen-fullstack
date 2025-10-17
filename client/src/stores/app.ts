import type { AppInfo, AppLog, BuildEvent } from '@gen-fullstack/shared';
import { MAX_LOGS } from '@gen-fullstack/shared';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

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
}

interface AppActions {
  setAppStatus: (status: AppInfo | null) => void;
  addAppLog: (log: AppLog) => void;
  addBuildEvent: (event: BuildEvent) => void;
  clearAppLogs: () => void;
  clearBuildEvents: () => void;
  reset: () => void;
  checkAndTruncateLogs: () => { truncated: boolean; count: number };
}

type AppStore = AppState & AppActions;

const initialState: AppState = {
  appStatus: null,
  appLogs: [],
  buildEvents: [],
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
        let truncated = false;
        let count = 0;

        set((draft) => {
          if (draft.appLogs.length > MAX_LOGS) {
            count = draft.appLogs.length - MAX_LOGS;
            draft.appLogs.splice(0, count);
            truncated = true;
          }
        });

        return { truncated, count };
      },
    })),
    { name: 'AppStore' },
  ),
);
