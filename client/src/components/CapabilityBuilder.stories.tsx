import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CapabilityBuilder } from './CapabilityBuilder';
import type { CapabilityConfig } from '@gen-fullstack/shared';

const meta = {
  title: 'Components/CapabilityBuilder',
  component: CapabilityBuilder,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div style={{ width: '600px' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CapabilityBuilder>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Wrapper component to enable interactive state management in Storybook
 */
function InteractiveWrapper({ initialConfig }: { initialConfig: CapabilityConfig }) {
  const [config, setConfig] = useState<CapabilityConfig>(initialConfig);
  const [model, setModel] = useState<'gpt-5' | 'gpt-5-mini' | 'gpt-5-nano'>('gpt-5-mini');
  return (
    <CapabilityBuilder value={config} onChange={setConfig} model={model} onModelChange={setModel} />
  );
}

export const QuickStart = () => (
  <InteractiveWrapper
    initialConfig={{ inputMode: 'naive', planning: false, compilerChecks: false, maxIterations: 3 }}
  />
);

export const SelfCorrecting = () => (
  <InteractiveWrapper
    initialConfig={{
      inputMode: 'naive',
      compilerChecks: true,
      maxIterations: 3,
      planning: false,
    }}
  />
);

export const Comprehensive = () => (
  <InteractiveWrapper
    initialConfig={{
      inputMode: 'naive',
      planning: true,
      compilerChecks: true,
      maxIterations: 3,
    }}
  />
);

export const TemplateMode = () => (
  <InteractiveWrapper
    initialConfig={{
      inputMode: 'template',
      templateOptions: {
        templateName: 'vite-fullstack-base',
      },
      planning: false,
      compilerChecks: false,
      maxIterations: 3,
    }}
  />
);

export const CompilerChecks = () => (
  <InteractiveWrapper
    initialConfig={{
      inputMode: 'naive',
      compilerChecks: true,
      planning: false,
      maxIterations: 3,
    }}
  />
);

export const Disabled: Story = {
  args: {
    value: { inputMode: 'naive', planning: false, compilerChecks: false, maxIterations: 3 },
    onChange: () => {},
    model: 'gpt-5-mini',
    onModelChange: () => {},
    disabled: true,
  },
};
