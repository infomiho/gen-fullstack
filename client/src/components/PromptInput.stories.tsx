import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from '@storybook/test';
import { useState } from 'react';
import { PromptInput } from './PromptInput';

/**
 * PromptInput allows users to enter their app description.
 * It's a controlled textarea component that manages the prompt text.
 */
const meta: Meta<typeof PromptInput> = {
  title: 'UI/Session/PromptInput',
  component: PromptInput,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    disabled: {
      control: 'boolean',
      description: 'Whether the input is disabled during generation',
    },
  },
};

export default meta;
type Story = StoryObj<typeof PromptInput>;

/**
 * Wrapper component for stories that need state management
 */
function PromptInputWrapper(
  props: Omit<React.ComponentProps<typeof PromptInput>, 'value' | 'onChange'>,
) {
  const [value, setValue] = useState('');
  return <PromptInput {...props} value={value} onChange={setValue} />;
}

/**
 * Default state - ready for input
 */
export const Default: Story = {
  args: {
    value: '',
    onChange: () => {},
    disabled: false,
  },
  render: (args) => <PromptInputWrapper disabled={args.disabled} />,
};

/**
 * Disabled state - during generation
 */
export const Disabled: Story = {
  args: {
    value: '',
    onChange: () => {},
    disabled: true,
  },
  render: (args) => <PromptInputWrapper disabled={args.disabled} />,
};

/**
 * With initial value
 */
export const WithValue: Story = {
  args: {
    value: 'Create a todo list app with user authentication',
    onChange: () => {},
    disabled: false,
  },
};

/**
 * Test: User can type into the textarea
 */
export const UserCanType: Story = {
  args: {
    value: '',
    onChange: () => {},
    disabled: false,
  },
  render: (args) => <PromptInputWrapper disabled={args.disabled} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Find the textarea by role (placeholder is animated, so can't rely on it)
    const textarea = canvas.getByRole('textbox');

    // Type into the textarea
    await userEvent.type(textarea, 'Create a todo app with React');

    // Verify text was entered
    await expect(textarea).toHaveValue('Create a todo app with React');
  },
};

/**
 * Test: Textarea is disabled during generation
 */
export const DisabledDuringGeneration: Story = {
  args: {
    value: '',
    onChange: () => {},
    disabled: true,
  },
  render: (args) => <PromptInputWrapper disabled={args.disabled} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Find textarea by role (placeholder is animated, so can't rely on it)
    const textarea = canvas.getByRole('textbox');

    // Textarea should be disabled
    await expect(textarea).toBeDisabled();
  },
};
