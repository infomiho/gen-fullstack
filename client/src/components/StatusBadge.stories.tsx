import type { Meta, StoryObj } from '@storybook/react-vite';
import { StatusBadge } from './StatusBadge';

const meta = {
  title: 'Components/StatusBadge',
  component: StatusBadge,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    status: {
      description: 'Status to display',
      control: 'select',
      options: [
        'completed',
        'generating',
        'failed',
        'creating',
        'installing',
        'starting',
        'running',
        'ready',
        'stopped',
      ],
    },
    variant: {
      description: 'Visual variant (affects styling)',
      control: 'select',
      options: ['default', 'session', 'app'],
    },
    showLiveIndicator: {
      description: 'Show pulsing live indicator (only for generating status)',
      control: 'boolean',
    },
    displayText: {
      description: 'Custom display text (overrides status value)',
      control: 'text',
    },
    uppercase: {
      description: 'Uppercase the text',
      control: 'boolean',
    },
  },
} satisfies Meta<typeof StatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

// Session statuses
export const Completed: Story = {
  args: {
    status: 'completed',
    variant: 'session',
  },
};

export const Generating: Story = {
  args: {
    status: 'generating',
    variant: 'session',
  },
};

export const GeneratingLive: Story = {
  args: {
    status: 'generating',
    variant: 'session',
    showLiveIndicator: true,
  },
};

export const Failed: Story = {
  args: {
    status: 'failed',
    variant: 'session',
  },
};

// App execution statuses
export const Running: Story = {
  args: {
    status: 'running',
    variant: 'app',
    uppercase: true,
  },
};

export const Creating: Story = {
  args: {
    status: 'creating',
    variant: 'app',
    uppercase: true,
  },
};

export const Installing: Story = {
  args: {
    status: 'installing',
    variant: 'app',
    uppercase: true,
  },
};

export const Starting: Story = {
  args: {
    status: 'starting',
    variant: 'app',
    uppercase: true,
  },
};

export const Stopped: Story = {
  args: {
    status: 'stopped',
    variant: 'app',
    uppercase: true,
  },
};

export const Idle: Story = {
  args: {
    status: 'stopped',
    variant: 'app',
    uppercase: true,
  },
};

// Custom display text
export const CustomText: Story = {
  args: {
    status: 'completed',
    displayText: 'Done',
    variant: 'session',
  },
};

// All variants comparison
export const AllSessionStatuses: Story = {
  args: { status: 'completed' },
  render: () => (
    <div className="flex flex-col gap-3">
      <StatusBadge status="generating" variant="session" showLiveIndicator />
      <StatusBadge status="generating" variant="session" />
      <StatusBadge status="completed" variant="session" />
      <StatusBadge status="failed" variant="session" />
    </div>
  ),
};

export const AllAppStatuses: Story = {
  args: { status: 'running' },
  render: () => (
    <div className="flex flex-col gap-3">
      <StatusBadge status="creating" variant="app" uppercase />
      <StatusBadge status="installing" variant="app" uppercase />
      <StatusBadge status="starting" variant="app" uppercase />
      <StatusBadge status="ready" variant="app" uppercase />
      <StatusBadge status="running" variant="app" uppercase />
      <StatusBadge status="stopped" variant="app" uppercase />
      <StatusBadge status="failed" variant="app" uppercase />
    </div>
  ),
};
