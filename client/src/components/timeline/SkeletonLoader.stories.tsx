import type { Meta, StoryObj } from '@storybook/react-vite';
import { SkeletonLoader } from './SkeletonLoader';

const meta = {
  title: 'Timeline/SkeletonLoader',
  component: SkeletonLoader,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof SkeletonLoader>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default skeleton loader shown during generation
 */
export const Default: Story = {};

/**
 * Multiple skeleton loaders in a timeline view
 */
export const InTimeline: Story = {
  render: () => (
    <div className="space-y-4 max-w-3xl">
      <SkeletonLoader />
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="text-sm text-gray-600">Previous message content...</div>
      </div>
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="text-sm text-gray-600">Another message...</div>
      </div>
    </div>
  ),
};
