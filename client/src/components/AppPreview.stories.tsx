import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppPreview } from './AppPreview';

/**
 * AppPreview displays an iframe preview of the running application.
 * Shows different states based on app status (idle, running, failed, etc.).
 */
const meta: Meta<typeof AppPreview> = {
  title: 'App/AppPreview',
  component: AppPreview,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AppPreview>;

/**
 * Idle state - app not started yet
 */
export const Idle: Story = {
  args: {
    appStatus: {
      sessionId: 'test-session-123',
      status: 'stopped',
    },
  },
};

/**
 * Creating container
 */
export const Creating: Story = {
  args: {
    appStatus: {
      sessionId: 'test-session-123',
      status: 'ready',
    },
  },
};

/**
 * Installing dependencies
 */
export const Installing: Story = {
  args: {
    appStatus: {
      sessionId: 'test-session-123',
      status: 'ready',
    },
  },
};

/**
 * Starting dev server
 */
export const Starting: Story = {
  args: {
    appStatus: {
      sessionId: 'test-session-123',
      status: 'ready',
    },
  },
};

/**
 * Running - shows iframe with preview URL
 */
export const Running: Story = {
  args: {
    appStatus: {
      sessionId: 'test-session-123',
      status: 'running',
      clientPort: 5173,
      serverPort: 3000,
      clientUrl: 'http://localhost:3001/preview/test-session-123',
      serverUrl: 'http://localhost:3002',
    },
  },
};

/**
 * Failed state with error message
 */
export const Failed: Story = {
  args: {
    appStatus: {
      sessionId: 'test-session-123',
      status: 'failed',
      error: 'Failed to start development server. Port 5173 is already in use.',
    },
  },
};

/**
 * Stopped state
 */
export const Stopped: Story = {
  args: {
    appStatus: {
      sessionId: 'test-session-123',
      status: 'stopped',
    },
  },
};

/**
 * Null status - no app info available
 */
export const NoStatus: Story = {
  args: {
    appStatus: null,
  },
};
