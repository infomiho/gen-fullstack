import type { AppInfo, AppLog, BuildEvent } from '@gen-fullstack/shared';
import { MAX_LOGS } from '@gen-fullstack/shared';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { truncateArray } from '../lib/array-utils.js';

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
        let result = { truncated: false, count: 0 };

        set((draft) => {
          result = truncateArray(draft.appLogs, MAX_LOGS);
        });

        return result;
      },
    })),
    { name: 'AppStore' },
  ),
);
