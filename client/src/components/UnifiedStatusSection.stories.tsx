import type { Meta, StoryObj } from '@storybook/react-vite';
import { UnifiedStatusSection } from './UnifiedStatusSection';
import type { AppInfo } from '@gen-fullstack/shared';

const meta = {
  title: 'UI/Session/UnifiedStatusSection',
  component: UnifiedStatusSection,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div style={{ width: '320px', padding: '1rem', backgroundColor: 'var(--card)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof UnifiedStatusSection>;

export default meta;
type Story = StoryObj<typeof meta>;

const mockAppStatusRunning: AppInfo = {
  sessionId: 'test-session',
  status: 'running',
  clientPort: 5001,
  clientUrl: 'http://localhost:5001',
  serverPort: 5101,
  serverUrl: 'http://localhost:5101',
};

const mockAppStatusStarting: AppInfo = {
  sessionId: 'test-session',
  status: 'starting',
  clientPort: 5001,
  clientUrl: '',
  serverPort: 5101,
  serverUrl: '',
};

const mockAppStatusFailed: AppInfo = {
  sessionId: 'test-session',
  status: 'failed',
  clientPort: 5001,
  clientUrl: '',
  serverPort: 5101,
  serverUrl: '',
  error: 'Port 5001 is already in use',
};

export const GeneratingOwn: Story = {
  args: {
    sessionStatus: 'generating',
    isOwnSession: true,
    currentSessionId: 'test-session',
    appStatus: null,
    isGenerating: true,
    onStart: () => console.log('Start clicked'),
    onStop: () => console.log('Stop clicked'),
    onStartClick: () => console.log('Start click handler'),
  },
};

export const GeneratingOther: Story = {
  args: {
    sessionStatus: 'generating',
    isOwnSession: false,
    currentSessionId: 'test-session',
    appStatus: null,
    isGenerating: true,
    onStart: () => console.log('Start clicked'),
    onStop: () => console.log('Stop clicked'),
  },
};

export const CompletedStopped: Story = {
  args: {
    sessionStatus: 'completed',
    isOwnSession: false,
    currentSessionId: 'test-session',
    appStatus: null,
    isGenerating: false,
    onStart: () => console.log('Start clicked'),
    onStop: () => console.log('Stop clicked'),
    onStartClick: () => console.log('Start click handler'),
  },
};

export const CompletedRunning: Story = {
  args: {
    sessionStatus: 'completed',
    isOwnSession: false,
    currentSessionId: 'test-session',
    appStatus: mockAppStatusRunning,
    isGenerating: false,
    onStart: () => console.log('Start clicked'),
    onStop: () => console.log('Stop clicked'),
  },
};

export const AppStarting: Story = {
  args: {
    sessionStatus: 'completed',
    isOwnSession: false,
    currentSessionId: 'test-session',
    appStatus: mockAppStatusStarting,
    isGenerating: false,
    onStart: () => console.log('Start clicked'),
    onStop: () => console.log('Stop clicked'),
  },
};

export const AppFailed: Story = {
  args: {
    sessionStatus: 'completed',
    isOwnSession: false,
    currentSessionId: 'test-session',
    appStatus: mockAppStatusFailed,
    isGenerating: false,
    onStart: () => console.log('Start clicked'),
    onStop: () => console.log('Stop clicked'),
    onStartClick: () => console.log('Start click handler'),
  },
};

export const Failed: Story = {
  args: {
    sessionStatus: 'failed',
    isOwnSession: false,
    currentSessionId: 'test-session',
    appStatus: null,
    isGenerating: false,
    onStart: () => console.log('Start clicked'),
    onStop: () => console.log('Stop clicked'),
    onStartClick: () => console.log('Start click handler'),
  },
};

export const NoSession: Story = {
  args: {
    sessionStatus: 'completed',
    isOwnSession: false,
    currentSessionId: null,
    appStatus: null,
    isGenerating: false,
    onStart: () => console.log('Start clicked'),
    onStop: () => console.log('Stop clicked'),
  },
};

export const StillGenerating: Story = {
  args: {
    sessionStatus: 'completed',
    isOwnSession: false,
    currentSessionId: 'test-session',
    appStatus: null,
    isGenerating: true,
    onStart: () => console.log('Start clicked'),
    onStop: () => console.log('Stop clicked'),
  },
};
