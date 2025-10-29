import type { Meta, StoryObj } from '@storybook/react-vite';
import { ErrorFixingContent } from './ErrorFixingContent';

const meta = {
  title: 'Pipeline/ErrorFixingContent',
  component: ErrorFixingContent,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ErrorFixingContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StartedFirstAttempt: Story = {
  args: {
    status: 'started',
    iteration: 1,
    maxIterations: 3,
    errorCount: 5,
  },
};

export const StartedSecondAttempt: Story = {
  args: {
    status: 'started',
    iteration: 2,
    maxIterations: 3,
    errorCount: 3,
  },
};

export const StartedSingleError: Story = {
  args: {
    status: 'started',
    iteration: 1,
    maxIterations: 3,
    errorCount: 1,
  },
};

export const Completed: Story = {
  args: {
    status: 'completed',
    iteration: 1,
    maxIterations: 3,
    errorCount: 5,
  },
};

export const Failed: Story = {
  args: {
    status: 'failed',
    iteration: 3,
    maxIterations: 3,
    errorCount: 2,
  },
};
