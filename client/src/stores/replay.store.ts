import { create } from 'zustand';

/**
 * Fixed playback speed for replay mode.
 * 10x provides fast demonstrations while remaining comprehensible.
 * Lower speeds (1-2x) are too slow for stage presentations.
 */
export const REPLAY_SPEED = 10;

interface ReplayStore {
  // Replay mode state
  isReplayMode: boolean;
  isPlaying: boolean;
  currentTime: number; // milliseconds from session start
  duration: number; // total session duration in milliseconds
  sessionStartTime: number; // session's createdAt timestamp
  sessionId: string | null;

  // Loaded session data
  timelineItems: Array<{
    id: string;
    type: 'message' | 'tool_call' | 'tool_result';
    timestamp: number;
    data: {
      role?: string;
      content?: string;
      name?: string;
      parameters?: Record<string, unknown>;
      toolCallId?: string;
      toolName?: string;
      result?: string;
    };
  }>;
  files: Array<{
    path: string;
    timestamp: number;
    content: string;
  }>;

  // Actions
  enterReplayMode: (
    sessionId: string,
    data: {
      sessionStartTime: number;
      duration: number;
      timelineItems: Array<{
        id: string;
        type: string;
        timestamp: number;
        data: Record<string, unknown>;
      }>;
      files: Array<{
        path: string;
        timestamp: number;
        content: string;
      }>;
    },
  ) => void;
  exitReplayMode: () => void;
  play: () => void;
  pause: () => void;
  seekTo: (time: number) => void;
  setCurrentTime: (time: number) => void;
}

export const useReplayStore = create<ReplayStore>((set) => ({
  // Initial state
  isReplayMode: false,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  sessionStartTime: 0,
  sessionId: null,
  timelineItems: [],
  files: [],

  // Actions
  enterReplayMode: (sessionId, data) =>
    set({
      isReplayMode: true,
      sessionId,
      sessionStartTime: data.sessionStartTime,
      duration: data.duration,
      timelineItems: data.timelineItems as Array<{
        id: string;
        type: 'message' | 'tool_call' | 'tool_result';
        timestamp: number;
        data: {
          role?: string;
          content?: string;
          name?: string;
          parameters?: Record<string, unknown>;
          toolCallId?: string;
          toolName?: string;
          result?: string;
        };
      }>,
      files: data.files,
      currentTime: 0,
      isPlaying: false,
    }),

  exitReplayMode: () =>
    set({
      isReplayMode: false,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      sessionStartTime: 0,
      sessionId: null,
      timelineItems: [],
      files: [],
    }),

  play: () => set({ isPlaying: true }),

  pause: () => set({ isPlaying: false }),

  seekTo: (time) =>
    set((state) => ({
      currentTime: Math.max(0, Math.min(time, state.duration)),
    })),

  setCurrentTime: (time) => set({ currentTime: time }),
}));
