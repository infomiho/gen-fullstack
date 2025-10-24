import { describe, it, expect, beforeEach } from 'vitest';
import { useReplayStore, REPLAY_SPEED } from '../replay.store';

describe('replay.store', () => {
  beforeEach(() => {
    // Reset store state before each test
    const store = useReplayStore.getState();
    store.exitReplayMode();
  });

  describe('Constants', () => {
    it('should have REPLAY_SPEED set to 10', () => {
      expect(REPLAY_SPEED).toBe(10);
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const state = useReplayStore.getState();

      expect(state.isReplayMode).toBe(false);
      expect(state.isPlaying).toBe(false);
      expect(state.currentTime).toBe(0);
      expect(state.duration).toBe(0);
      expect(state.sessionStartTime).toBe(0);
      expect(state.sessionId).toBe(null);
      expect(state.timelineItems).toEqual([]);
      expect(state.files).toEqual([]);
    });
  });

  describe('enterReplayMode', () => {
    it('should enter replay mode with session data', () => {
      const sessionId = 'test-session-123';
      const sessionData = {
        sessionStartTime: 1000,
        duration: 60000,
        timelineItems: [
          {
            id: '1',
            type: 'message',
            timestamp: 2000,
            data: { role: 'user', content: 'Hello' },
          },
        ],
        files: [
          {
            path: 'test.ts',
            timestamp: 3000,
            content: 'console.log("test")',
          },
        ],
      };

      useReplayStore.getState().enterReplayMode(sessionId, sessionData);
      const state = useReplayStore.getState();

      expect(state.isReplayMode).toBe(true);
      expect(state.sessionId).toBe(sessionId);
      expect(state.sessionStartTime).toBe(1000);
      expect(state.duration).toBe(60000);
      expect(state.timelineItems).toHaveLength(1);
      expect(state.files).toHaveLength(1);
      expect(state.currentTime).toBe(0);
      expect(state.isPlaying).toBe(false);
    });

    it('should reset currentTime and isPlaying when entering replay mode', () => {
      // Set up initial replay mode
      useReplayStore.getState().enterReplayMode('session-1', {
        sessionStartTime: 1000,
        duration: 60000,
        timelineItems: [],
        files: [],
      });

      // Modify state
      useReplayStore.getState().play();
      useReplayStore.getState().setCurrentTime(30000);

      // Enter new replay mode
      useReplayStore.getState().enterReplayMode('session-2', {
        sessionStartTime: 2000,
        duration: 120000,
        timelineItems: [],
        files: [],
      });

      const state = useReplayStore.getState();
      expect(state.currentTime).toBe(0);
      expect(state.isPlaying).toBe(false);
    });
  });

  describe('exitReplayMode', () => {
    it('should exit replay mode and reset all state', () => {
      // Enter replay mode first
      useReplayStore.getState().enterReplayMode('session-123', {
        sessionStartTime: 1000,
        duration: 60000,
        timelineItems: [
          {
            id: '1',
            type: 'message',
            timestamp: 2000,
            data: { role: 'user', content: 'Test' },
          },
        ],
        files: [],
      });

      // Modify state
      useReplayStore.getState().play();
      useReplayStore.getState().setCurrentTime(30000);

      // Exit replay mode
      useReplayStore.getState().exitReplayMode();
      const state = useReplayStore.getState();

      expect(state.isReplayMode).toBe(false);
      expect(state.isPlaying).toBe(false);
      expect(state.currentTime).toBe(0);
      expect(state.duration).toBe(0);
      expect(state.sessionStartTime).toBe(0);
      expect(state.sessionId).toBe(null);
      expect(state.timelineItems).toEqual([]);
      expect(state.files).toEqual([]);
    });
  });

  describe('play/pause', () => {
    it('should set isPlaying to true when play is called', () => {
      useReplayStore.getState().play();
      expect(useReplayStore.getState().isPlaying).toBe(true);
    });

    it('should set isPlaying to false when pause is called', () => {
      useReplayStore.getState().play();
      useReplayStore.getState().pause();
      expect(useReplayStore.getState().isPlaying).toBe(false);
    });

    it('should toggle between play and pause', () => {
      const store = useReplayStore.getState();

      expect(store.isPlaying).toBe(false);

      store.play();
      expect(useReplayStore.getState().isPlaying).toBe(true);

      store.pause();
      expect(useReplayStore.getState().isPlaying).toBe(false);

      store.play();
      expect(useReplayStore.getState().isPlaying).toBe(true);
    });
  });

  describe('seekTo', () => {
    beforeEach(() => {
      useReplayStore.getState().enterReplayMode('session-123', {
        sessionStartTime: 1000,
        duration: 60000,
        timelineItems: [],
        files: [],
      });
    });

    it('should seek to a valid time within duration', () => {
      useReplayStore.getState().seekTo(30000);
      expect(useReplayStore.getState().currentTime).toBe(30000);
    });

    it('should clamp seek time to 0 if negative', () => {
      useReplayStore.getState().seekTo(-5000);
      expect(useReplayStore.getState().currentTime).toBe(0);
    });

    it('should clamp seek time to duration if exceeding', () => {
      useReplayStore.getState().seekTo(90000); // exceeds 60000 duration
      expect(useReplayStore.getState().currentTime).toBe(60000);
    });

    it('should allow seeking to exactly 0', () => {
      useReplayStore.getState().setCurrentTime(30000);
      useReplayStore.getState().seekTo(0);
      expect(useReplayStore.getState().currentTime).toBe(0);
    });

    it('should allow seeking to exactly duration', () => {
      useReplayStore.getState().seekTo(60000);
      expect(useReplayStore.getState().currentTime).toBe(60000);
    });
  });

  describe('setCurrentTime', () => {
    it('should set current time directly', () => {
      useReplayStore.getState().setCurrentTime(15000);
      expect(useReplayStore.getState().currentTime).toBe(15000);
    });

    it('should allow setting time beyond duration (no clamping)', () => {
      useReplayStore.getState().enterReplayMode('session-123', {
        sessionStartTime: 1000,
        duration: 60000,
        timelineItems: [],
        files: [],
      });

      useReplayStore.getState().setCurrentTime(90000);
      expect(useReplayStore.getState().currentTime).toBe(90000);
    });

    it('should allow setting negative time (no clamping)', () => {
      useReplayStore.getState().setCurrentTime(-5000);
      expect(useReplayStore.getState().currentTime).toBe(-5000);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle full replay lifecycle', () => {
      // Start in normal mode
      expect(useReplayStore.getState().isReplayMode).toBe(false);

      // Enter replay mode
      useReplayStore.getState().enterReplayMode('session-123', {
        sessionStartTime: 1000,
        duration: 120000,
        timelineItems: [
          {
            id: '1',
            type: 'message',
            timestamp: 2000,
            data: { role: 'user', content: 'Hello' },
          },
        ],
        files: [
          {
            path: 'app.ts',
            timestamp: 3000,
            content: 'code',
          },
        ],
      });

      let state = useReplayStore.getState();
      expect(state.isReplayMode).toBe(true);
      expect(state.currentTime).toBe(0);

      // Start playing
      useReplayStore.getState().play();
      expect(useReplayStore.getState().isPlaying).toBe(true);

      // Seek to middle
      useReplayStore.getState().seekTo(60000);
      state = useReplayStore.getState();
      expect(state.currentTime).toBe(60000);
      expect(state.isPlaying).toBe(true);

      // Pause
      useReplayStore.getState().pause();
      expect(useReplayStore.getState().isPlaying).toBe(false);

      // Exit replay mode
      useReplayStore.getState().exitReplayMode();
      state = useReplayStore.getState();
      expect(state.isReplayMode).toBe(false);
      expect(state.currentTime).toBe(0);
    });

    it('should handle switching between sessions', () => {
      // Enter first session
      useReplayStore.getState().enterReplayMode('session-1', {
        sessionStartTime: 1000,
        duration: 60000,
        timelineItems: [],
        files: [],
      });

      useReplayStore.getState().play();
      useReplayStore.getState().setCurrentTime(30000);

      // Switch to second session
      useReplayStore.getState().enterReplayMode('session-2', {
        sessionStartTime: 5000,
        duration: 90000,
        timelineItems: [],
        files: [],
      });

      const state = useReplayStore.getState();
      expect(state.sessionId).toBe('session-2');
      expect(state.sessionStartTime).toBe(5000);
      expect(state.duration).toBe(90000);
      expect(state.currentTime).toBe(0);
      expect(state.isPlaying).toBe(false);
    });
  });
});
