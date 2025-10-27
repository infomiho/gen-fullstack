import { create } from 'zustand';
import type { CapabilityConfig } from '@gen-fullstack/shared';

export type PresentationOverlay =
  | 'none'
  | 'generation-start' // "READY... FIGHT!"
  | 'tool-hud' // Live tool call display
  | 'file-created' // Achievement toast
  | 'error-ko' // "K.O." screen
  | 'victory'; // Final stats

export interface ComboState {
  count: number;
  lastToolCallTime: number;
  highestCombo: number;
}

export interface PresentationStats {
  duration: number; // Generation time in seconds
  toolCalls: number; // Total tool calls made
  filesCreated: number; // Total files written
  successRate: number; // Percentage (0-100)
  combos: number; // Highest combo achieved
}

export interface PresentationState {
  // Mode toggle
  isEnabled: boolean;
  setEnabled: (enabled: boolean) => void;
  toggleEnabled: () => void;

  // Current overlay
  currentOverlay: PresentationOverlay;
  setOverlay: (overlay: PresentationOverlay) => void;

  // Current generation config
  currentConfig: CapabilityConfig | null;
  setCurrentConfig: (config: CapabilityConfig | null) => void;

  // Combo system
  combo: ComboState;
  incrementCombo: () => void;
  resetCombo: () => void;

  // Stats tracking
  stats: PresentationStats;
  updateStats: (partial: Partial<PresentationStats>) => void;
  resetStats: () => void;

  // Recent activity for HUD
  recentToolCalls: Array<{
    name: string;
    file?: string;
    timestamp: number;
  }>;
  addToolCall: (name: string, file?: string) => void;

  // Audio control
  isMuted: boolean;
  toggleMute: () => void;
  volume: number;
  setVolume: (volume: number) => void;
}

const initialStats: PresentationStats = {
  duration: 0,
  toolCalls: 0,
  filesCreated: 0,
  successRate: 0,
  combos: 0,
};

const initialCombo: ComboState = {
  count: 0,
  lastToolCallTime: 0,
  highestCombo: 0,
};

export const usePresentationStore = create<PresentationState>((set) => ({
  // Mode toggle
  isEnabled: false,
  setEnabled: (enabled) => set({ isEnabled: enabled }),
  toggleEnabled: () => set((state) => ({ isEnabled: !state.isEnabled })),

  // Current overlay
  currentOverlay: 'none',
  setOverlay: (overlay) => set({ currentOverlay: overlay }),

  // Current generation config
  currentConfig: null,
  setCurrentConfig: (config) => set({ currentConfig: config }),

  // Combo system
  combo: initialCombo,
  incrementCombo: () =>
    set((state) => {
      const now = Date.now();
      const timeSinceLastCall = now - state.combo.lastToolCallTime;
      const comboWindow = 1000; // 1 second to maintain combo

      let newCount = state.combo.count;
      if (timeSinceLastCall < comboWindow && state.combo.lastToolCallTime > 0) {
        newCount = state.combo.count + 1;
      } else {
        newCount = 1; // Start new combo
      }

      const newHighest = Math.max(newCount, state.combo.highestCombo);

      return {
        combo: {
          count: newCount,
          lastToolCallTime: now,
          highestCombo: newHighest,
        },
        stats: {
          ...state.stats,
          combos: newHighest,
        },
      };
    }),
  resetCombo: () =>
    set((state) => ({
      combo: {
        ...initialCombo,
        highestCombo: state.combo.highestCombo,
      },
    })),

  // Stats tracking
  stats: initialStats,
  updateStats: (partial) =>
    set((state) => ({
      stats: { ...state.stats, ...partial },
    })),
  resetStats: () =>
    set({
      stats: initialStats,
      combo: initialCombo,
      recentToolCalls: [],
    }),

  // Recent activity
  recentToolCalls: [],
  addToolCall: (name, file) =>
    set((state) => {
      const newToolCall = {
        name,
        file,
        timestamp: Date.now(),
      };

      // Keep only last 5 tool calls
      const updated = [newToolCall, ...state.recentToolCalls].slice(0, 5);

      return { recentToolCalls: updated };
    }),

  // Audio control
  isMuted: true, // Default to muted
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  volume: 0.7,
  setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
}));
