import type { Meta, StoryObj } from '@storybook/react-vite';
import { HelpCircle } from 'lucide-react';
import { HoverInfo } from './HoverInfo';

const meta = {
  title: 'Components/HoverInfo',
  component: HoverInfo,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof HoverInfo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    content: 'This is helpful information that appears on hover.',
  },
};

export const LongContent: Story = {
  args: {
    content:
      'This is a longer tooltip with more detailed information. It can span multiple lines and provide comprehensive context about the feature or option.',
  },
};

export const CustomIcon: Story = {
  args: {
    content: 'Custom icon tooltip',
    children: <HelpCircle className="w-4 h-4" />,
  },
};

export const InContext: Story = {
  args: { content: '' },
  render: () => (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-gray-700">Smart Planning</span>
      <HoverInfo content="Generates an architectural plan before writing code. This includes database schema, API endpoints, and component structure." />
    </div>
  ),
};

export const MultipleTooltips: Story = {
  args: { content: '' },
  render: () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Planning</span>
        <HoverInfo content="Design architecture first before implementation" />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Template</span>
        <HoverInfo content="Start from a working full-stack template" />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700">Compiler Checks</span>
        <HoverInfo content="Automatically validate and fix TypeScript and Prisma errors" />
      </div>
    </div>
  ),
};
