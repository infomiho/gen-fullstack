import type { Meta, StoryObj } from '@storybook/react-vite';
import { TimelineScrubber } from './TimelineScrubber';
import { useReplayStore } from '../stores/replay.store';

/**
 * TimelineScrubber provides a visual timeline with:
 * - Draggable progress bar for seeking
 * - Event markers showing when messages/tools occurred
 * - Click to jump to position
 * - Hover preview showing time
 */
const meta = {
  title: 'Replay/TimelineScrubber',
  component: TimelineScrubber,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof TimelineScrubber>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default state - at the beginning
 */
export const Default: Story = {
  args: {},
  play: async () => {
    const now = Date.now();
    useReplayStore.getState().enterReplayMode('story-session', {
      sessionStartTime: now,
      duration: 120000, // 2 minutes
      timelineItems: [
        // Messages at various times
        {
          id: '1',
          type: 'message',
          timestamp: now + 5000,
          data: { role: 'user', content: 'Hello' },
        },
        {
          id: '2',
          type: 'message',
          timestamp: now + 10000,
          data: { role: 'assistant', content: 'Hi' },
        },
        // Tool calls
        {
          id: '3',
          type: 'tool_call',
          timestamp: now + 30000,
          data: { name: 'readFile', parameters: {} },
        },
        {
          id: '4',
          type: 'tool_call',
          timestamp: now + 45000,
          data: { name: 'writeFile', parameters: {} },
        },
        // Tool results
        {
          id: '5',
          type: 'tool_result',
          timestamp: now + 32000,
          data: { result: 'success' },
        },
        {
          id: '6',
          type: 'tool_result',
          timestamp: now + 47000,
          data: { result: 'success' },
        },
        // More messages
        {
          id: '7',
          type: 'message',
          timestamp: now + 60000,
          data: { role: 'user', content: 'Thanks' },
        },
        {
          id: '8',
          type: 'message',
          timestamp: now + 90000,
          data: { role: 'assistant', content: 'Done' },
        },
      ],
      files: [],
    });
  },
};

/**
 * Halfway through the timeline
 */
export const HalfwayThrough: Story = {
  args: {},
  play: async () => {
    const now = Date.now();
    useReplayStore.getState().enterReplayMode('story-session', {
      sessionStartTime: now,
      duration: 120000,
      timelineItems: [
        {
          id: '1',
          type: 'message',
          timestamp: now + 5000,
          data: { role: 'user', content: 'Hello' },
        },
        {
          id: '2',
          type: 'message',
          timestamp: now + 10000,
          data: { role: 'assistant', content: 'Hi' },
        },
      ],
      files: [],
    });
    const store = useReplayStore.getState();
    store.setCurrentTime(store.duration / 2);
  },
};

/**
 * Near the end
 */
export const NearEnd: Story = {
  args: {},
  play: async () => {
    const now = Date.now();
    useReplayStore.getState().enterReplayMode('story-session', {
      sessionStartTime: now,
      duration: 120000,
      timelineItems: [
        {
          id: '1',
          type: 'message',
          timestamp: now + 5000,
          data: { role: 'user', content: 'Hello' },
        },
      ],
      files: [],
    });
    const store = useReplayStore.getState();
    store.setCurrentTime(store.duration - 10000);
  },
};

/**
 * Empty timeline - no events
 */
export const EmptyTimeline: Story = {
  args: {},
  play: async () => {
    useReplayStore.getState().enterReplayMode('empty-session', {
      sessionStartTime: Date.now(),
      duration: 60000,
      timelineItems: [],
      files: [],
    });
  },
};

/**
 * Many events - tests performance with lots of markers
 */
export const ManyEvents: Story = {
  args: {},
  play: async () => {
    const now = Date.now();
    const duration = 300000; // 5 minutes

    // Generate 100 events
    const timelineItems = Array.from({ length: 100 }, (_, i) => ({
      id: `event-${i}`,
      type: (i % 3 === 0 ? 'message' : i % 3 === 1 ? 'tool_call' : 'tool_result') as
        | 'message'
        | 'tool_call'
        | 'tool_result',
      timestamp: now + (duration / 100) * i,
      data: { role: 'assistant', content: `Event ${i}` },
    }));

    useReplayStore.getState().enterReplayMode('many-events', {
      sessionStartTime: now,
      duration,
      timelineItems,
      files: [],
    });
  },
};

/**
 * Very short session
 */
export const ShortSession: Story = {
  args: {},
  play: async () => {
    const now = Date.now();
    useReplayStore.getState().enterReplayMode('short-session', {
      sessionStartTime: now,
      duration: 15000, // 15 seconds
      timelineItems: [
        {
          id: '1',
          type: 'message',
          timestamp: now + 2000,
          data: { role: 'user', content: 'Quick question' },
        },
        {
          id: '2',
          type: 'message',
          timestamp: now + 5000,
          data: { role: 'assistant', content: 'Quick answer' },
        },
      ],
      files: [],
    });
  },
};
