import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { CapabilityConfig } from '@gen-fullstack/shared';
import { CapabilitySection } from './CapabilitySection';

const meta = {
  title: 'Components/CapabilitySection',
  component: CapabilitySection,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof CapabilitySection>;

export default meta;
type Story = StoryObj<typeof meta>;

// Wrapper component to manage state
function SectionWrapper(
  props: Omit<React.ComponentProps<typeof CapabilitySection>, 'onConfigChange'>,
) {
  const [config, setConfig] = useState(props.config);
  return <CapabilitySection {...props} config={config} onConfigChange={setConfig} />;
}

export const QuickStart: Story = {
  args: {
    config: {
      inputMode: 'naive' as const,
      planning: false,
      compilerChecks: false,
      maxIterations: 3,
    },
    onConfigChange: () => {},
  },
  render: () => (
    <div className="max-w-2xl">
      <SectionWrapper
        config={{
          inputMode: 'naive',
          planning: false,
          compilerChecks: false,
          maxIterations: 3,
        }}
      />
    </div>
  ),
};

export const SelfCorrecting: Story = {
  args: {
    config: {
      inputMode: 'naive' as const,
      planning: false,
      compilerChecks: false,
      maxIterations: 3,
    },
    onConfigChange: () => {},
  },
  render: () => (
    <div className="max-w-2xl">
      <SectionWrapper
        config={{
          inputMode: 'naive',
          planning: false,
          compilerChecks: true,
          maxIterations: 3,
        }}
      />
    </div>
  ),
};

export const Comprehensive: Story = {
  args: {
    config: {
      inputMode: 'naive' as const,
      planning: false,
      compilerChecks: false,
      maxIterations: 3,
    },
    onConfigChange: () => {},
  },
  render: () => (
    <div className="max-w-2xl">
      <SectionWrapper
        config={{
          inputMode: 'naive',
          planning: true,
          compilerChecks: true,
          maxIterations: 3,
        }}
      />
    </div>
  ),
};

export const WithTemplate: Story = {
  args: {
    config: {
      inputMode: 'naive' as const,
      planning: false,
      compilerChecks: false,
      maxIterations: 3,
    },
    onConfigChange: () => {},
  },
  render: () => (
    <div className="max-w-2xl">
      <SectionWrapper
        config={{
          inputMode: 'template',
          templateOptions: {
            templateName: 'vite-fullstack-base',
          },
          planning: false,
          compilerChecks: false,
          maxIterations: 3,
        }}
      />
    </div>
  ),
};

export const CustomConfiguration: Story = {
  args: {
    config: {
      inputMode: 'naive' as const,
      planning: false,
      compilerChecks: false,
      maxIterations: 3,
    },
    onConfigChange: () => {},
  },
  render: () => (
    <div className="max-w-2xl">
      <SectionWrapper
        config={{
          inputMode: 'template',
          templateOptions: {
            templateName: 'vite-fullstack-base',
          },
          planning: true,
          compilerChecks: true,
          maxIterations: 5,
        }}
      />
    </div>
  ),
};

export const Disabled: Story = {
  args: {
    config: {
      inputMode: 'naive' as const,
      planning: false,
      compilerChecks: false,
      maxIterations: 3,
    },
    onConfigChange: () => {},
  },
  render: () => (
    <div className="max-w-2xl">
      <SectionWrapper
        config={{
          inputMode: 'naive',
          planning: true,
          compilerChecks: true,
          maxIterations: 3,
        }}
        disabled
      />
    </div>
  ),
};

export const Interactive: Story = {
  args: {
    config: {
      inputMode: 'naive' as const,
      planning: false,
      compilerChecks: false,
      maxIterations: 3,
    },
    onConfigChange: () => {},
  },
  render: () => {
    const [config, setConfig] = useState<CapabilityConfig>({
      inputMode: 'naive',
      planning: false,
      compilerChecks: false,
      maxIterations: 3,
    });

    return (
      <div className="max-w-2xl space-y-6">
        <CapabilitySection config={config} onConfigChange={setConfig} />
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Current Configuration:</h3>
          <pre className="text-xs font-mono text-gray-600">{JSON.stringify(config, null, 2)}</pre>
        </div>
      </div>
    );
  },
};
