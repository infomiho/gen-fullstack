import type { CapabilityConfig } from '@gen-fullstack/shared';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { Store } from '../lib/store-utils.js';

/**
 * Generation Config Store
 *
 * Manages generation configuration state such as prompt drafts and capability settings.
 * State is persisted to localStorage for user convenience across sessions.
 */

interface GenerationConfigState {
  // Prompt draft - saved as user types
  promptDraft: string;
  // Capability configuration - input mode and toggles
  capabilityConfig: CapabilityConfig;
}

interface GenerationConfigActions {
  setPromptDraft: (value: string) => void;
  clearPromptDraft: () => void;
  setCapabilityConfig: (config: CapabilityConfig) => void;
  resetConfig: () => void;
}

type GenerationConfigStore = Store<GenerationConfigState, GenerationConfigActions>;

const initialState: GenerationConfigState = {
  promptDraft: '',
  capabilityConfig: {
    inputMode: 'naive',
    planning: false,
    compilerChecks: false,
    buildingBlocks: false,
    maxIterations: 3,
  },
};

export const useGenerationConfigStore = create<GenerationConfigStore>()(
  devtools(
    persist(
      immer((set) => ({
        ...initialState,

        setPromptDraft: (value) =>
          set((state) => {
            state.promptDraft = value;
          }),

        clearPromptDraft: () =>
          set((state) => {
            state.promptDraft = '';
          }),

        setCapabilityConfig: (config) =>
          set((state) => {
            state.capabilityConfig = config;
          }),

        resetConfig: () =>
          set((state) => {
            state.promptDraft = initialState.promptDraft;
            state.capabilityConfig = initialState.capabilityConfig;
          }),
      })),
      {
        name: 'generation-config-store',
        // Persist both prompt draft and capability config
        partialize: (state) => ({
          promptDraft: state.promptDraft,
          capabilityConfig: state.capabilityConfig,
        }),
      },
    ),
    { name: 'GenerationConfigStore' },
  ),
);
