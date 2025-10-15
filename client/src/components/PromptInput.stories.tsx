import type { Meta, StoryObj } from '@storybook/react-vite';
import { PromptInput } from './PromptInput';
import { useState } from 'react';
import { expect, userEvent, within } from '@storybook/test';

/**
 * PromptInput allows users to enter their app description and submit it for generation.
 * It includes a textarea for multi-line input and a submit button with icon.
 */
const meta: Meta<typeof PromptInput> = {
  title: 'Components/PromptInput',
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
 * Default state - ready for input
 */
export const Default: Story = {
  args: {
    onSubmit: (_prompt: string) => {},
    disabled: false,
  },
};

/**
 * Disabled state - during generation
 */
export const Disabled: Story = {
  args: {
    onSubmit: (_prompt: string) => {},
    disabled: true,
  },
};

/**
 * Interactive demo with state management
 */
function InteractiveDemo() {
  const [submittedPrompt, setSubmittedPrompt] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleSubmit = (prompt: string) => {
    setSubmittedPrompt(prompt);
    setIsGenerating(true);
    // Simulate generation
    setTimeout(() => setIsGenerating(false), 3000);
  };

  return (
    <div className="space-y-4">
      <PromptInput onSubmit={handleSubmit} disabled={isGenerating} />

      {submittedPrompt && (
        <div className="p-4 bg-gray-50 rounded border">
          <p className="text-sm font-semibold mb-2">
            {isGenerating ? 'Generating...' : 'Generation Complete'}
          </p>
          <p className="text-sm text-gray-700">Prompt: {submittedPrompt}</p>
        </div>
      )}
    </div>
  );
}

export const Interactive: Story = {
  render: () => <InteractiveDemo />,
};

/**
 * Test: User can type and submit a prompt
 */
export const UserCanSubmitPrompt: Story = {
  args: {
    onSubmit: (_prompt: string) => {},
    disabled: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Find the textarea
    const textarea = canvas.getByPlaceholderText('Describe your app...');

    // Type into the textarea
    await userEvent.type(textarea, 'Create a todo app with React');

    // Verify text was entered
    await expect(textarea).toHaveValue('Create a todo app with React');

    // Find and click the submit button
    const submitButton = canvas.getByRole('button', { name: /generate/i });
    await userEvent.click(submitButton);

    // After submission, textarea should be empty
    await expect(textarea).toHaveValue('');
  },
};

/**
 * Test: Submit button is disabled when textarea is empty
 */
export const SubmitDisabledWhenEmpty: Story = {
  args: {
    onSubmit: (_prompt: string) => {},
    disabled: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const submitButton = canvas.getByRole('button', { name: /generate/i });

    // Button should be disabled when empty
    await expect(submitButton).toBeDisabled();
  },
};

/**
 * Test: Component is disabled during generation
 */
export const DisabledDuringGeneration: Story = {
  args: {
    onSubmit: (_prompt: string) => {},
    disabled: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const textarea = canvas.getByPlaceholderText('Describe your app...');
    const submitButton = canvas.getByRole('button', { name: /generate/i });

    // Both should be disabled
    await expect(textarea).toBeDisabled();
    await expect(submitButton).toBeDisabled();
  },
};
