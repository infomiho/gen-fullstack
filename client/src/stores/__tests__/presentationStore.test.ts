import { describe, it, expect, beforeEach } from 'vitest';
import { usePresentationStore } from '../presentationStore';
import type { PresentationEvent } from '../presentationStore';

describe('presentationStore', () => {
  beforeEach(() => {
    // Reset store before each test
    const store = usePresentationStore.getState();
    store.setEnabled(false);
    store.resetPresentation();
    store.resetStats();
  });

  describe('mode toggle', () => {
    it('should start disabled', () => {
      const { isEnabled } = usePresentationStore.getState();
      expect(isEnabled).toBe(false);
    });

    it('should toggle enabled state', () => {
      const { toggleEnabled } = usePresentationStore.getState();

      toggleEnabled();
      expect(usePresentationStore.getState().isEnabled).toBe(true);

      toggleEnabled();
      expect(usePresentationStore.getState().isEnabled).toBe(false);
    });

    it('should set enabled state directly', () => {
      const { setEnabled } = usePresentationStore.getState();

      setEnabled(true);
      expect(usePresentationStore.getState().isEnabled).toBe(true);

      setEnabled(false);
      expect(usePresentationStore.getState().isEnabled).toBe(false);
    });
  });

  describe('presentation queue', () => {
    const mockQueue: PresentationEvent[] = [
      { type: 'generation-start', duration: 6000 },
      { type: 'planning', duration: 400, data: { planItem: { type: 'model', name: 'User' } } },
      { type: 'victory', duration: 6000 },
    ];

    it('should load presentation queue and start auto-playing', () => {
      const { loadPresentationQueue } = usePresentationStore.getState();

      loadPresentationQueue(mockQueue);

      const state = usePresentationStore.getState();
      expect(state.presentationQueue).toEqual(mockQueue);
      expect(state.currentEventIndex).toBe(0);
      expect(state.isAutoPlaying).toBe(true);
      expect(state.currentOverlay).toBe('generation-start');
    });

    it('should set overlay data from first event', () => {
      const queueWithData: PresentationEvent[] = [
        {
          type: 'planning',
          duration: 400,
          data: { planItem: { type: 'model', name: 'User' } },
        },
      ];

      const { loadPresentationQueue } = usePresentationStore.getState();
      loadPresentationQueue(queueWithData);

      const { overlayData } = usePresentationStore.getState();
      expect(overlayData).toEqual({
        planItem: { type: 'model', name: 'User' },
      });
    });

    it('should advance to next event', () => {
      const { loadPresentationQueue, nextEvent } = usePresentationStore.getState();
      loadPresentationQueue(mockQueue);

      nextEvent();

      const state = usePresentationStore.getState();
      expect(state.currentEventIndex).toBe(1);
      expect(state.currentOverlay).toBe('planning');
      expect(state.overlayData.planItem).toEqual({ type: 'model', name: 'User' });
    });

    it('should stop auto-playing at end of queue', () => {
      const { loadPresentationQueue, nextEvent } = usePresentationStore.getState();
      loadPresentationQueue(mockQueue);

      // Advance through all events
      nextEvent(); // Index 1
      nextEvent(); // Index 2
      nextEvent(); // Try to go beyond queue

      const { isAutoPlaying, currentEventIndex } = usePresentationStore.getState();
      expect(isAutoPlaying).toBe(false);
      expect(currentEventIndex).toBe(2); // Stays at last valid index
    });

    it('should go to previous event', () => {
      const { loadPresentationQueue, nextEvent, previousEvent } = usePresentationStore.getState();
      loadPresentationQueue(mockQueue);

      nextEvent(); // Go to index 1
      expect(usePresentationStore.getState().currentEventIndex).toBe(1);

      previousEvent(); // Go back to index 0
      const state = usePresentationStore.getState();
      expect(state.currentEventIndex).toBe(0);
      expect(state.currentOverlay).toBe('generation-start');
    });

    it('should not go before first event', () => {
      const { loadPresentationQueue, previousEvent } = usePresentationStore.getState();
      loadPresentationQueue(mockQueue);

      previousEvent(); // Try to go before index 0

      const { currentEventIndex } = usePresentationStore.getState();
      expect(currentEventIndex).toBe(0);
    });

    it('should reset to first event', () => {
      const { loadPresentationQueue, nextEvent, resetPresentation } =
        usePresentationStore.getState();
      loadPresentationQueue(mockQueue);

      nextEvent();
      nextEvent();
      expect(usePresentationStore.getState().currentEventIndex).toBe(2);

      resetPresentation();
      const state = usePresentationStore.getState();
      expect(state.currentEventIndex).toBe(0);
      expect(state.isAutoPlaying).toBe(false);
      expect(state.currentOverlay).toBe('generation-start');
    });
  });

  describe('playback controls', () => {
    const mockQueue: PresentationEvent[] = [
      { type: 'generation-start', duration: 6000 },
      { type: 'victory', duration: 6000 },
    ];

    it('should pause presentation', () => {
      const { loadPresentationQueue, pausePresentation } = usePresentationStore.getState();
      loadPresentationQueue(mockQueue);

      expect(usePresentationStore.getState().isAutoPlaying).toBe(true);

      pausePresentation();
      expect(usePresentationStore.getState().isAutoPlaying).toBe(false);
    });

    it('should resume presentation', () => {
      const { loadPresentationQueue, pausePresentation, playPresentation } =
        usePresentationStore.getState();
      loadPresentationQueue(mockQueue);

      pausePresentation();
      expect(usePresentationStore.getState().isAutoPlaying).toBe(false);

      playPresentation();
      expect(usePresentationStore.getState().isAutoPlaying).toBe(true);
    });

    it('should restart from beginning when playing at end', () => {
      const { loadPresentationQueue, nextEvent, playPresentation } =
        usePresentationStore.getState();
      loadPresentationQueue(mockQueue);

      nextEvent(); // Go to last event (index 1)
      expect(usePresentationStore.getState().currentEventIndex).toBe(1);

      playPresentation();
      const state = usePresentationStore.getState();
      expect(state.currentEventIndex).toBe(0);
      expect(state.isAutoPlaying).toBe(true);
      expect(state.currentOverlay).toBe('generation-start');
    });
  });

  describe('stats tracking', () => {
    it('should start with zero stats', () => {
      const { stats } = usePresentationStore.getState();
      expect(stats).toEqual({
        duration: 0,
        toolCalls: 0,
        filesCreated: 0,
        successRate: 0,
        combos: 0,
      });
    });

    it('should update stats partially', () => {
      const { updateStats } = usePresentationStore.getState();

      updateStats({ toolCalls: 5, filesCreated: 3 });

      const { stats } = usePresentationStore.getState();
      expect(stats.toolCalls).toBe(5);
      expect(stats.filesCreated).toBe(3);
      expect(stats.duration).toBe(0); // Unchanged
    });

    it('should update stats from victory event', () => {
      const queueWithStats: PresentationEvent[] = [
        {
          type: 'victory',
          duration: 6000,
          data: {
            stats: {
              duration: 42,
              toolCalls: 20,
              filesCreated: 15,
              successRate: 100,
              combos: 15,
            },
          },
        },
      ];

      const { loadPresentationQueue } = usePresentationStore.getState();
      loadPresentationQueue(queueWithStats);

      // Queue loads at index 0 (victory event)
      const { stats } = usePresentationStore.getState();
      expect(stats).toEqual({
        duration: 42,
        toolCalls: 20,
        filesCreated: 15,
        successRate: 100,
        combos: 15,
      });
    });

    it('should reset stats', () => {
      const { updateStats, resetStats } = usePresentationStore.getState();

      updateStats({ toolCalls: 10, filesCreated: 5 });
      expect(usePresentationStore.getState().stats.toolCalls).toBe(10);

      resetStats();
      expect(usePresentationStore.getState().stats).toEqual({
        duration: 0,
        toolCalls: 0,
        filesCreated: 0,
        successRate: 0,
        combos: 0,
      });
    });
  });

  describe('combo system', () => {
    it('should start with zero combo', () => {
      const { combo } = usePresentationStore.getState();
      expect(combo).toEqual({
        count: 0,
        lastToolCallTime: 0,
        highestCombo: 0,
      });
    });

    it('should increment combo on first call', () => {
      const { incrementCombo } = usePresentationStore.getState();

      incrementCombo();

      const { combo } = usePresentationStore.getState();
      expect(combo.count).toBe(1);
      expect(combo.highestCombo).toBe(1);
      expect(combo.lastToolCallTime).toBeGreaterThan(0);
    });

    it('should increment combo for consecutive calls within window', () => {
      const { incrementCombo } = usePresentationStore.getState();

      incrementCombo();
      incrementCombo();
      incrementCombo();

      const { combo } = usePresentationStore.getState();
      expect(combo.count).toBe(3);
      expect(combo.highestCombo).toBe(3);
    });

    it('should reset combo count but preserve highest', () => {
      const { incrementCombo, resetCombo } = usePresentationStore.getState();

      incrementCombo();
      incrementCombo();
      incrementCombo();
      expect(usePresentationStore.getState().combo.count).toBe(3);

      resetCombo();

      const { combo } = usePresentationStore.getState();
      expect(combo.count).toBe(0);
      expect(combo.highestCombo).toBe(3); // Preserved
    });

    it('should update stats combos with highest combo', () => {
      const { incrementCombo } = usePresentationStore.getState();

      incrementCombo();
      incrementCombo();
      incrementCombo();

      const { stats } = usePresentationStore.getState();
      expect(stats.combos).toBe(3);
    });
  });

  describe('recent activity', () => {
    it('should start with empty recent tool calls', () => {
      const { recentToolCalls } = usePresentationStore.getState();
      expect(recentToolCalls).toEqual([]);
    });

    it('should add tool call to recent activity', () => {
      const { addToolCall } = usePresentationStore.getState();

      addToolCall('writeFile', 'test.ts');

      const { recentToolCalls } = usePresentationStore.getState();
      expect(recentToolCalls).toHaveLength(1);
      expect(recentToolCalls[0]).toMatchObject({
        name: 'writeFile',
        file: 'test.ts',
      });
      expect(recentToolCalls[0].timestamp).toBeGreaterThan(0);
    });

    it('should keep only last 5 tool calls', () => {
      const { addToolCall } = usePresentationStore.getState();

      // Add 7 tool calls
      for (let i = 0; i < 7; i++) {
        addToolCall(`tool${i}`, `file${i}.ts`);
      }

      const { recentToolCalls } = usePresentationStore.getState();
      expect(recentToolCalls).toHaveLength(5);
      expect(recentToolCalls[0].name).toBe('tool6'); // Most recent first
    });
  });

  describe('planning history', () => {
    it('should start with empty planning history', () => {
      const { planningHistory } = usePresentationStore.getState();
      expect(planningHistory).toEqual([]);
    });

    it('should add planning item to history', () => {
      const { addPlanningItem } = usePresentationStore.getState();

      addPlanningItem('model', 'User');

      const { planningHistory } = usePresentationStore.getState();
      expect(planningHistory).toHaveLength(1);
      expect(planningHistory[0]).toMatchObject({
        type: 'model',
        name: 'User',
      });
    });

    it('should keep only last 3 planning items', () => {
      const { addPlanningItem } = usePresentationStore.getState();

      addPlanningItem('model', 'User');
      addPlanningItem('model', 'Post');
      addPlanningItem('endpoint', '/users');
      addPlanningItem('component', 'Header');

      const { planningHistory } = usePresentationStore.getState();
      expect(planningHistory).toHaveLength(3);
      expect(planningHistory[0].name).toBe('Header'); // Most recent first
    });

    it('should not add duplicate of most recent item', () => {
      const { addPlanningItem } = usePresentationStore.getState();

      addPlanningItem('model', 'User');
      addPlanningItem('model', 'User'); // Duplicate

      const { planningHistory } = usePresentationStore.getState();
      expect(planningHistory).toHaveLength(1);
    });

    it('should clear planning history on reset', () => {
      const { addPlanningItem, clearPlanningHistory } = usePresentationStore.getState();

      addPlanningItem('model', 'User');
      addPlanningItem('model', 'Post');
      expect(usePresentationStore.getState().planningHistory).toHaveLength(2);

      clearPlanningHistory();
      expect(usePresentationStore.getState().planningHistory).toEqual([]);
    });
  });

  describe('audio control', () => {
    it('should start muted by default', () => {
      const { isMuted } = usePresentationStore.getState();
      expect(isMuted).toBe(true);
    });

    it('should toggle mute', () => {
      const { toggleMute } = usePresentationStore.getState();

      toggleMute();
      expect(usePresentationStore.getState().isMuted).toBe(false);

      toggleMute();
      expect(usePresentationStore.getState().isMuted).toBe(true);
    });

    it('should set volume', () => {
      const { setVolume } = usePresentationStore.getState();

      setVolume(0.5);
      expect(usePresentationStore.getState().volume).toBe(0.5);
    });

    it('should clamp volume between 0 and 1', () => {
      const { setVolume } = usePresentationStore.getState();

      setVolume(1.5); // Too high
      expect(usePresentationStore.getState().volume).toBe(1);

      setVolume(-0.5); // Too low
      expect(usePresentationStore.getState().volume).toBe(0);
    });
  });

  describe('overlay management', () => {
    it('should start with no overlay when no queue loaded', () => {
      // Ensure queue is empty
      usePresentationStore.setState({
        presentationQueue: [],
        currentEventIndex: -1,
        currentOverlay: 'none',
      });

      const { currentOverlay } = usePresentationStore.getState();
      expect(currentOverlay).toBe('none');
    });

    it('should set current overlay', () => {
      const { setOverlay } = usePresentationStore.getState();

      setOverlay('generation-start');
      expect(usePresentationStore.getState().currentOverlay).toBe('generation-start');
    });

    it('should set overlay data', () => {
      const { setOverlayData } = usePresentationStore.getState();

      const data = {
        planItem: { type: 'model' as const, name: 'User' },
      };

      setOverlayData(data);
      expect(usePresentationStore.getState().overlayData).toEqual(data);
    });
  });

  describe('config management', () => {
    it('should start with null config', () => {
      const { currentConfig } = usePresentationStore.getState();
      expect(currentConfig).toBeNull();
    });

    it('should set current config', () => {
      const { setCurrentConfig } = usePresentationStore.getState();

      const config = {
        inputMode: 'template' as const,
        planning: true,
        compilerChecks: false,
        maxIterations: 3,
        buildingBlocks: false,
        templateOptions: { templateName: 'vite-fullstack-base' },
      };

      setCurrentConfig(config);
      expect(usePresentationStore.getState().currentConfig).toEqual(config);
    });
  });
});
