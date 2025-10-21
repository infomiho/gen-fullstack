import type { Meta, StoryObj } from '@storybook/react-vite';
import { ConfigBadge } from './ConfigBadge';

const meta = {
  title: 'Components/ConfigBadge',
  component: ConfigBadge,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    enabled: {
      description: 'Whether the feature is enabled',
      control: 'boolean',
    },
    label: {
      description: 'Label text to display',
      control: 'text',
    },
  },
} satisfies Meta<typeof ConfigBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Enabled: Story = {
  args: {
    enabled: true,
    label: 'Planning',
  },
};

export const Disabled: Story = {
  args: {
    enabled: false,
    label: 'Planning',
  },
};

export const CompilerChecksEnabled: Story = {
  name: 'Compiler Checks (Enabled)',
  args: {
    enabled: true,
    label: 'Compiler Checks',
  },
};

export const CompilerChecksDisabled: Story = {
  name: 'Compiler Checks (Disabled)',
  args: {
    enabled: false,
    label: 'Compiler Checks',
  },
};

export const AllStates: Story = {
  args: { enabled: true, label: 'example' },
  render: () => (
    <div className="space-y-3 max-w-md">
      <ConfigBadge enabled label="Planning" />
      <ConfigBadge enabled={false} label="Planning" />
      <ConfigBadge enabled label="Compiler Checks" />
      <ConfigBadge enabled={false} label="Compiler Checks" />
      <ConfigBadge enabled label="Custom Feature" />
      <ConfigBadge enabled={false} label="Custom Feature" />
    </div>
  ),
};

// Real SessionSidebar usage
export const SessionSidebarExample: Story = {
  args: { enabled: true, label: 'example' },
  name: 'SessionSidebar Usage',
  render: () => (
    <div className="space-y-3 max-w-md border rounded-lg p-4">
      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
        Configuration
      </h3>
      <div className="space-y-2">
        <ConfigBadge enabled label="Planning" />
        <ConfigBadge enabled label="Compiler Checks" />
      </div>
    </div>
  ),
};
