import type { Meta, StoryObj } from '@storybook/react-vite';
import { StageStatusIndicator } from './StageStatusIndicator';

const meta = {
  title: 'Pipeline/StageStatusIndicator',
  component: StageStatusIndicator,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof StageStatusIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Completed: Story = {
  args: {
    status: 'completed',
  },
};

export const Failed: Story = {
  args: {
    status: 'failed',
  },
};

export const Started: Story = {
  args: {
    status: 'started',
  },
};

export const AllStatuses: Story = {
  args: {
    status: 'started',
  },
  render: () => (
    <div className="flex gap-8 items-center">
      <div className="flex items-center gap-2">
        <StageStatusIndicator status="started" />
        <span className="text-sm">Started</span>
      </div>
      <div className="flex items-center gap-2">
        <StageStatusIndicator status="completed" />
        <span className="text-sm">Completed</span>
      </div>
      <div className="flex items-center gap-2">
        <StageStatusIndicator status="failed" />
        <span className="text-sm">Failed</span>
      </div>
    </div>
  ),
};
