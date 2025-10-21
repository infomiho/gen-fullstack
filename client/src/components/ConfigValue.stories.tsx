import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConfigValue } from './ConfigValue';

const meta = {
  title: 'Components/ConfigValue',
  component: ConfigValue,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    label: {
      description: 'Label text to display',
      control: 'text',
    },
    value: {
      description: 'Value text to display',
      control: 'text',
    },
    variant: {
      description: 'Color variant for the value badge',
      control: 'select',
      options: ['blue', 'purple', 'gray'],
    },
  },
} satisfies Meta<typeof ConfigValue>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InputModeNaive: Story = {
  name: 'Input Mode (Naive)',
  args: {
    label: 'Input Mode',
    value: 'Naive',
    variant: 'blue',
  },
};

export const InputModeTemplate: Story = {
  name: 'Input Mode (Template)',
  args: {
    label: 'Input Mode',
    value: 'Template',
    variant: 'blue',
  },
};

export const ModelValue: Story = {
  name: 'Model (Purple)',
  args: {
    label: 'Model',
    value: 'gpt-5-mini',
    variant: 'purple',
  },
};

export const StatusValue: Story = {
  name: 'Status (Gray)',
  args: {
    label: 'Status',
    value: 'Idle',
    variant: 'gray',
  },
};

export const AllVariants: Story = {
  args: { label: 'example', value: 'example' },
  render: () => (
    <div className="space-y-3 max-w-md">
      <ConfigValue label="Input Mode" value="Naive" variant="blue" />
      <ConfigValue label="Input Mode" value="Template" variant="blue" />
      <ConfigValue label="Model" value="gpt-5" variant="purple" />
      <ConfigValue label="Model" value="gpt-5-mini" variant="purple" />
      <ConfigValue label="Model" value="gpt-5-nano" variant="purple" />
      <ConfigValue label="Status" value="Active" variant="gray" />
    </div>
  ),
};

// Real SessionSidebar usage
export const SessionSidebarExample: Story = {
  args: { label: 'example', value: 'example' },
  name: 'SessionSidebar Usage',
  render: () => (
    <div className="space-y-3 max-w-md border rounded-lg p-4">
      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
        Configuration
      </h3>
      <div className="space-y-2">
        <ConfigValue label="Input Mode" value="Template" />
        <ConfigValue label="Model" value="gpt-5-mini" variant="purple" />
      </div>
    </div>
  ),
};

// Combined with ConfigBadge
export const CombinedExample: Story = {
  args: { label: 'example', value: 'example' },
  name: 'Combined with ConfigBadge',
  render: () => {
    // Note: In real usage, import ConfigBadge at the top of the file
    // This story demonstrates the combined layout without the actual ConfigBadge
    return (
      <div className="space-y-3 max-w-md border rounded-lg p-4">
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
          Configuration
        </h3>
        <div className="space-y-2">
          <ConfigValue label="Input Mode" value="Naive" />
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Planning:</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              Enabled
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Compiler Checks:</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              Enabled
            </span>
          </div>
        </div>
      </div>
    );
  },
};
