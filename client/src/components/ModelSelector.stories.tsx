import type { Meta, StoryObj } from '@storybook/react-vite';
import { useId, useState } from 'react';
import type { StartGenerationPayload } from '@gen-fullstack/shared';
import { ModelSelector } from './ModelSelector';

const meta = {
  title: 'Primitives/ModelSelector',
  component: ModelSelector,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ minWidth: '400px' }}>
        <Story />
      </div>
    ),
  ],
  argTypes: {
    selectedModel: {
      description: 'Currently selected model',
      control: 'select',
      options: [
        'gpt-5',
        'gpt-5-mini',
        'gpt-5-nano',
        'claude-haiku-4-5',
        'claude-sonnet-4-5',
        'claude-opus-4-1',
      ],
    },
    disabled: {
      description: 'Whether the selector is disabled (e.g., during generation)',
      control: 'boolean',
    },
  },
} satisfies Meta<typeof ModelSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    selectedModel: 'gpt-5-mini',
    onModelChange: () => {},
    disabled: false,
  },
};

export const GPT5: Story = {
  args: {
    selectedModel: 'gpt-5',
    onModelChange: () => {},
    disabled: false,
  },
};

export const GPT5Nano: Story = {
  args: {
    selectedModel: 'gpt-5-nano',
    onModelChange: () => {},
    disabled: false,
  },
};

export const ClaudeHaiku: Story = {
  args: {
    selectedModel: 'claude-haiku-4-5',
    onModelChange: () => {},
    disabled: false,
  },
};

export const ClaudeSonnet: Story = {
  args: {
    selectedModel: 'claude-sonnet-4-5',
    onModelChange: () => {},
    disabled: false,
  },
};

export const ClaudeOpus: Story = {
  args: {
    selectedModel: 'claude-opus-4-1',
    onModelChange: () => {},
    disabled: false,
  },
};

export const Disabled: Story = {
  args: {
    selectedModel: 'gpt-5-mini',
    onModelChange: () => {},
    disabled: true,
  },
};

/**
 * Interactive example showing model selection changes
 */
export const Interactive = () => {
  const [selectedModel, setSelectedModel] = useState<StartGenerationPayload['model']>('gpt-5-mini');

  return (
    <div className="space-y-4">
      <ModelSelector selectedModel={selectedModel} onModelChange={setSelectedModel} />
      <div className="text-sm text-muted-foreground">
        Selected: <span className="font-mono font-medium text-foreground">{selectedModel}</span>
      </div>
    </div>
  );
};

/**
 * Example showing the selector in a form context
 */
export const InFormContext = () => {
  const textareaId = useId();
  const [selectedModel, setSelectedModel] = useState<StartGenerationPayload['model']>('gpt-5-mini');
  const [isGenerating, setIsGenerating] = useState(false);

  return (
    <div className="w-96 space-y-4 p-6 border border-border rounded-lg bg-card">
      <div>
        <label htmlFor={textareaId} className="block text-sm font-medium text-foreground mb-2">
          Application Prompt
        </label>
        <textarea
          id={textareaId}
          className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm"
          placeholder="Describe your app..."
          rows={4}
          disabled={isGenerating}
        />
      </div>

      <ModelSelector
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        disabled={isGenerating}
      />

      <button
        type="button"
        onClick={() => setIsGenerating(!isGenerating)}
        className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        disabled={isGenerating}
      >
        {isGenerating ? 'Generating...' : 'Generate'}
      </button>
    </div>
  );
};

/**
 * Comparison of all available models
 */
export const AllModels = () => {
  const models: Array<{ model: StartGenerationPayload['model']; label: string }> = [
    { model: 'gpt-5', label: 'GPT-5 (OpenAI)' },
    { model: 'gpt-5-mini', label: 'GPT-5 Mini (OpenAI)' },
    { model: 'gpt-5-nano', label: 'GPT-5 Nano (OpenAI)' },
    { model: 'claude-opus-4-1', label: 'Claude Opus 4.1 (Anthropic)' },
    { model: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5 (Anthropic)' },
    { model: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (Anthropic)' },
  ];

  return (
    <div className="space-y-3 w-96">
      {models.map(({ model, label }) => (
        <div key={model} className="border border-border rounded-lg p-4 bg-card">
          <div className="text-xs text-muted-foreground mb-2">{label}</div>
          <ModelSelector selectedModel={model} onModelChange={() => {}} />
        </div>
      ))}
    </div>
  );
};
