import type { AppInfo } from '@gen-fullstack/shared';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppControls } from './AppControls';

/**
 * AppControls provides a single button to manage app lifecycle (start/stop/restart).
 * Button text, icon, and state adapt based on current app status and generation state.
 */
const meta: Meta<typeof AppControls> = {
  title: 'App/AppControls',
  component: AppControls,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AppControls>;

const mockAppStatus: AppInfo = {
  sessionId: 'test-session-123',
  status: 'stopped',
};

/**
 * Idle state - ready to start
 */
export const Idle: Story = {
  args: {
    currentSessionId: 'test-session-123',
    appStatus: mockAppStatus,
    isGenerating: false,
    onStart: () => {},
    onStop: () => {},
  },
};

/**
 * Creating container state
 */
export const Creating: Story = {
  args: {
    currentSessionId: 'test-session-123',
    appStatus: { sessionId: 'test-session-123', status: 'creating' },
    isGenerating: false,
    onStart: () => {},
    onStop: () => {},
  },
};

/**
 * Installing dependencies state
 */
export const Installing: Story = {
  args: {
    currentSessionId: 'test-session-123',
    appStatus: { sessionId: 'test-session-123', status: 'installing' },
    isGenerating: false,
    onStart: () => {},
    onStop: () => {},
  },
};

/**
 * Starting server state
 */
export const Starting: Story = {
  args: {
    currentSessionId: 'test-session-123',
    appStatus: { sessionId: 'test-session-123', status: 'starting' },
    isGenerating: false,
    onStart: () => {},
    onStop: () => {},
  },
};

/**
 * Running state - app is live
 */
export const Running: Story = {
  args: {
    currentSessionId: 'test-session-123',
    appStatus: {
      sessionId: 'test-session-123',
      status: 'running',
      clientPort: 5173,
      serverPort: 3000,
      clientUrl: 'http://localhost:5173',
      serverUrl: 'http://localhost:3000',
    },
    isGenerating: false,
    onStart: () => {},
    onStop: () => {},
  },
};

/**
 * Failed state - error occurred
 */
export const Failed: Story = {
  args: {
    currentSessionId: 'test-session-123',
    appStatus: {
      sessionId: 'test-session-123',
      status: 'failed',
      error: 'Failed to start dev server',
    },
    isGenerating: false,
    onStart: () => {},
    onStop: () => {},
  },
};

/**
 * Stopped state - app was stopped
 */
export const Stopped: Story = {
  args: {
    currentSessionId: 'test-session-123',
    appStatus: { sessionId: 'test-session-123', status: 'stopped' },
    isGenerating: false,
    onStart: () => {},
    onStop: () => {},
  },
};

/**
 * Generation in progress - controls disabled
 */
export const GenerationInProgress: Story = {
  args: {
    currentSessionId: 'test-session-123',
    appStatus: mockAppStatus,
    isGenerating: true,
    onStart: () => {},
    onStop: () => {},
  },
};

/**
 * No session ID - waiting for generation
 */
export const NoSession: Story = {
  args: {
    currentSessionId: null,
    appStatus: mockAppStatus,
    isGenerating: false,
    onStart: () => {},
    onStop: () => {},
  },
};
