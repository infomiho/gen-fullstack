import { create } from 'zustand';
import type { CapabilityConfig } from '@gen-fullstack/shared';
import { extractOverlayData } from '../lib/presentation-type-guards';

export type PresentationOverlay =
  | 'none'
  | 'generation-start' // "READY... FIGHT!"
  | 'template-loading' // Template mode notification
  | 'planning' // Architecture planning
  | 'block-request' // Building block request
  | 'tool-hud' // Live tool call display
  | 'combo-milestone' // Combo achievement (5x, 10x, 20x+)
  | 'validation-prisma' // Prisma schema validation
  | 'validation-typescript' // TypeScript validation
  | 'validation-result' // Validation result (pass/fail)
  | 'file-created' // Achievement toast (deprecated - use combo-milestone)
  | 'error-ko' // "K.O." screen
  | 'victory'; // Final stats

/**
 * Presentation overlay data structure (used by overlayData in store)
 */
export interface PresentationOverlayData {
  planItem?: {
    type: 'model' | 'endpoint' | 'component';
    name: string;
  };
  blockName?: string;
  validationResult?: { passed: boolean; errorCount?: number; iteration?: number };
  comboMilestone?: number;
  toolCall?: { name: string; file?: string };
  stats?: PresentationStats;
  fileName?: string;
}

/**
 * Presentation overlay event - pre-computed from timeline
 * Discriminated union ensures type-safe event creation
 */
export type PresentationEvent =
  // Events with no data
  | { type: 'none'; duration: number }
  | { type: 'generation-start'; duration: number }
  | { type: 'template-loading'; duration: number }
  | { type: 'validation-prisma'; duration: number }
  | { type: 'validation-typescript'; duration: number }
  | { type: 'error-ko'; duration: number }
  | { type: 'tool-hud'; duration: number }
  // Events with specific data
  | {
      type: 'planning';
      duration: number;
      data: { planItem: { type: 'model' | 'endpoint' | 'component'; name: string } };
    }
  | { type: 'block-request'; duration: number; data: { blockName: string } }
  | {
      type: 'validation-result';
      duration: number;
      data: { validationResult: { passed: boolean; errorCount?: number; iteration?: number } };
    }
  | { type: 'combo-milestone'; duration: number; data: { comboMilestone: number } }
  | { type: 'file-created'; duration: number; data: { fileName: string } }
  | { type: 'victory'; duration: number; data: { stats: PresentationStats } };

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

  // Presentation queue (independent of replay timing)
  presentationQueue: PresentationEvent[];
  currentEventIndex: number;
  isAutoPlaying: boolean;
  loadPresentationQueue: (events: PresentationEvent[]) => void;
  nextEvent: () => void;
  previousEvent: () => void;
  playPresentation: () => void;
  pausePresentation: () => void;
  resetPresentation: () => void;

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

  // Planning history for trailing effect
  planningHistory: Array<{
    type: 'model' | 'endpoint' | 'component';
    name: string;
    timestamp: number;
  }>;
  addPlanningItem: (type: 'model' | 'endpoint' | 'component', name: string) => void;
  clearPlanningHistory: () => void;

  // Overlay-specific data
  overlayData: PresentationOverlayData;
  setOverlayData: (data: PresentationOverlayData) => void;

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

  // Presentation queue
  presentationQueue: [],
  currentEventIndex: -1,
  isAutoPlaying: false,

  loadPresentationQueue: (events) => {
    // Immediately show first event when loading queue and start auto-playing
    const firstEvent = events[0];
    const overlayData = firstEvent ? extractOverlayData(firstEvent) : {};
    const updates: Partial<PresentationState> = {
      presentationQueue: events,
      currentEventIndex: 0,
      isAutoPlaying: true, // Auto-start playback
      currentOverlay: firstEvent?.type || 'none',
      overlayData,
      planningHistory: [], // Clear planning history for fresh start
    };

    // If first event has stats (e.g., victory overlay), update stats immediately
    if (overlayData.stats) {
      updates.stats = overlayData.stats;
    }

    set(updates);
  },

  nextEvent: () =>
    set((state) => {
      const nextIndex = state.currentEventIndex + 1;
      if (nextIndex >= state.presentationQueue.length) {
        // End of presentation
        return { isAutoPlaying: false };
      }

      const event = state.presentationQueue[nextIndex];
      const overlayData = extractOverlayData(event);

      // Update stats if the event has stats data (e.g., victory overlay)
      const updates: Partial<PresentationState> = {
        currentEventIndex: nextIndex,
        currentOverlay: event.type,
        overlayData,
      };

      if (overlayData.stats) {
        updates.stats = overlayData.stats;
      }

      return updates;
    }),

  previousEvent: () =>
    set((state) => {
      const prevIndex = state.currentEventIndex - 1;
      if (prevIndex < 0) {
        // Can't go before first event
        return {};
      }

      const event = state.presentationQueue[prevIndex];
      return {
        currentEventIndex: prevIndex,
        currentOverlay: event.type,
        overlayData: extractOverlayData(event),
      };
    }),

  playPresentation: () =>
    set((state) => {
      // If at end, restart from beginning
      if (state.currentEventIndex >= state.presentationQueue.length - 1) {
        const firstEvent = state.presentationQueue[0];
        return {
          isAutoPlaying: true,
          currentEventIndex: 0,
          currentOverlay: firstEvent?.type || 'none',
          overlayData: firstEvent ? extractOverlayData(firstEvent) : {},
        };
      }
      return { isAutoPlaying: true };
    }),

  pausePresentation: () => set({ isAutoPlaying: false }),

  resetPresentation: () =>
    set((state) => {
      const firstEvent = state.presentationQueue[0];
      return {
        currentEventIndex: 0,
        isAutoPlaying: false,
        currentOverlay: firstEvent?.type || 'none',
        overlayData: firstEvent ? extractOverlayData(firstEvent) : {},
        planningHistory: [], // Clear planning history on reset
      };
    }),

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
      planningHistory: [],
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

  // Planning history
  planningHistory: [],
  addPlanningItem: (type, name) =>
    set((state) => {
      // Check if this exact item is already the most recent
      const mostRecent = state.planningHistory[0];
      if (mostRecent && mostRecent.type === type && mostRecent.name === name) {
        // Don't add duplicate
        return {};
      }

      const newItem = {
        type,
        name,
        timestamp: Date.now(),
      };

      // Keep last 3 items for trailing effect
      const updated = [newItem, ...state.planningHistory].slice(0, 3);

      return { planningHistory: updated };
    }),
  clearPlanningHistory: () => set({ planningHistory: [] }),

  // Overlay-specific data
  overlayData: {},
  setOverlayData: (data) => set({ overlayData: data }),

  // Audio control
  isMuted: true, // Default to muted
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  volume: 0.7,
  setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
}));
