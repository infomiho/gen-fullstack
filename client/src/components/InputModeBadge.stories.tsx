import type { Meta, StoryObj } from '@storybook/react-vite';
import { InputModeBadge } from './InputModeBadge';

const meta = {
  title: 'Components/InputModeBadge',
  component: InputModeBadge,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof InputModeBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Naive input mode badge (blue)
 */
export const Naive: Story = {
  args: {
    inputMode: 'naive',
  },
};

/**
 * Template input mode badge (green)
 */
export const Template: Story = {
  args: {
    inputMode: 'template',
  },
};

/**
 * Both badges side by side
 */
export const AllModes: Story = {
  render: () => (
    <div className="flex gap-2">
      <InputModeBadge inputMode="naive" />
      <InputModeBadge inputMode="template" />
    </div>
  ),
  args: {
    inputMode: 'naive',
  },
};
