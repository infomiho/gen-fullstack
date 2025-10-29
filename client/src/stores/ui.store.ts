import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { Store } from '../lib/store-utils.js';

/**
 * UI Store
 *
 * Manages UI-related state such as sidebar section collapse state.
 * State is persisted to localStorage for user preferences.
 */

type SidebarSection = 'capabilities' | 'prompt' | 'metrics';

interface UIState {
  // Sidebar collapse state - true means collapsed
  sidebarCollapsed: Record<SidebarSection, boolean>;
}

interface UIActions {
  toggleSection: (section: SidebarSection) => void;
  setSection: (section: SidebarSection, collapsed: boolean) => void;
  resetSidebarCollapse: () => void;
}

type UIStore = Store<UIState, UIActions>;

const initialState: UIState = {
  sidebarCollapsed: {
    capabilities: false,
    prompt: false,
    metrics: false,
  },
};

export const useUIStore = create<UIStore>()(
  devtools(
    persist(
      immer((set) => ({
        ...initialState,

        toggleSection: (section) =>
          set((state) => {
            state.sidebarCollapsed[section] = !state.sidebarCollapsed[section];
          }),

        setSection: (section, collapsed) =>
          set((state) => {
            state.sidebarCollapsed[section] = collapsed;
          }),

        resetSidebarCollapse: () =>
          set((state) => {
            state.sidebarCollapsed = initialState.sidebarCollapsed;
          }),
      })),
      {
        name: 'ui-store',
        // Only persist sidebar collapse state
        partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed }),
      },
    ),
    { name: 'UIStore' },
  ),
);
