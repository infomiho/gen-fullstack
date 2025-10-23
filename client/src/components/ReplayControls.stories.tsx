import type { Meta, StoryObj } from '@storybook/react-vite';
import { ReplayControls } from './ReplayControls';
import { useReplayStore } from '../stores/replay.store';

/**
 * ReplayControls provides playback controls for replay mode:
 * - Play/pause button
 * - Speed selector (0.5x, 1x, 2x, 5x)
 * - Time display (current/total)
 */
const meta = {
  title: 'Replay/ReplayControls',
  component: ReplayControls,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof ReplayControls>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default state - at the beginning of playback
 */
export const Default: Story = {
  args: {},
  play: async () => {
    const store = useReplayStore.getState();
    store.enterReplayMode('story-session', {
      sessionStartTime: Date.now(),
      duration: 120000, // 2 minutes
      timelineItems: [],
      files: [],
    });
    store.pause();
    store.setCurrentTime(0);
  },
};

/**
 * Playing state
 */
export const Playing: Story = {
  args: {},
  play: async () => {
    const store = useReplayStore.getState();
    store.enterReplayMode('story-session', {
      sessionStartTime: Date.now(),
      duration: 120000,
      timelineItems: [],
      files: [],
    });
    store.play();
  },
};

/**
 * Halfway through playback
 */
export const HalfwayThrough: Story = {
  args: {},
  play: async () => {
    const store = useReplayStore.getState();
    store.enterReplayMode('story-session', {
      sessionStartTime: Date.now(),
      duration: 120000,
      timelineItems: [],
      files: [],
    });
    store.setCurrentTime(60000); // 1 minute
    store.pause();
  },
};

/**
 * Near the end
 */
export const NearEnd: Story = {
  args: {},
  play: async () => {
    const store = useReplayStore.getState();
    store.enterReplayMode('story-session', {
      sessionStartTime: Date.now(),
      duration: 120000,
      timelineItems: [],
      files: [],
    });
    store.setCurrentTime(110000); // 1:50
    store.pause();
  },
};

/**
 * Fast speed (5x)
 */
export const FastSpeed: Story = {
  args: {},
  play: async () => {
    const store = useReplayStore.getState();
    store.enterReplayMode('story-session', {
      sessionStartTime: Date.now(),
      duration: 120000,
      timelineItems: [],
      files: [],
    });
    store.setSpeed(5);
    store.pause();
  },
};

/**
 * Slow speed (0.5x)
 */
export const SlowSpeed: Story = {
  args: {},
  play: async () => {
    const store = useReplayStore.getState();
    store.enterReplayMode('story-session', {
      sessionStartTime: Date.now(),
      duration: 120000,
      timelineItems: [],
      files: [],
    });
    store.setSpeed(0.5);
    store.pause();
  },
};

/**
 * Short session (15 seconds)
 */
export const ShortSession: Story = {
  args: {},
  play: async () => {
    const store = useReplayStore.getState();
    store.enterReplayMode('story-session', {
      sessionStartTime: Date.now(),
      duration: 15000,
      timelineItems: [],
      files: [],
    });
    store.pause();
  },
};

/**
 * Long session (10 minutes)
 */
export const LongSession: Story = {
  args: {},
  play: async () => {
    const store = useReplayStore.getState();
    store.enterReplayMode('story-session', {
      sessionStartTime: Date.now(),
      duration: 600000, // 10 minutes
      timelineItems: [],
      files: [],
    });
    store.pause();
  },
};
