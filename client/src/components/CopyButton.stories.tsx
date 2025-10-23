import type { Meta, StoryObj } from '@storybook/react-vite';
import { CopyButton } from './CopyButton';

/**
 * CopyButton component for copying text to clipboard with visual feedback.
 */
const meta = {
  title: 'Components/CopyButton',
  component: CopyButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {
    text: 'Hello world! This is some sample text to copy.',
  },
} satisfies Meta<typeof CopyButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Default copy button
 */
export const Default: Story = {
  args: {},
};

/**
 * With custom title
 */
export const CustomTitle: Story = {
  args: {
    title: 'Copy code',
  },
};

/**
 * With larger icon
 */
export const LargerIcon: Story = {
  args: {
    iconSize: 20,
    title: 'Copy prompt',
  },
};

/**
 * In a card context (like session list)
 */
export const InCard: Story = {
  render: (args) => (
    <div className="w-96 p-4 border border-gray-200 rounded-lg bg-white">
      <div className="flex items-start gap-2">
        <p className="text-sm text-gray-900 leading-relaxed flex-1">{args.text}</p>
        <CopyButton {...args} />
      </div>
    </div>
  ),
};

/**
 * In a header context (like session sidebar)
 */
export const InHeader: Story = {
  args: {
    iconSize: 16,
  },
  render: (args) => (
    <div className="w-80 p-6 border border-gray-200 bg-white">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-medium text-gray-900">Prompt</h3>
        <CopyButton {...args} />
      </div>
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{args.text}</p>
      </div>
    </div>
  ),
};

/**
 * Multiple buttons showing different states
 */
export const AllStates: Story = {
  render: () => (
    <div className="flex gap-4 items-center">
      <div className="text-center">
        <CopyButton text="Sample text" />
        <p className="text-xs text-gray-500 mt-2">Default (hover to see)</p>
      </div>
    </div>
  ),
};
