import type { Meta, StoryObj } from '@storybook/react-vite';
import { Zap, Target, Rocket } from 'lucide-react';
import { useState } from 'react';
import { PresetBadge } from './PresetBadge';

const meta = {
  title: 'Components/PresetBadge',
  component: PresetBadge,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof PresetBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Inactive: Story = {
  args: {
    label: 'Quick Start',
    icon: Zap,
    active: false,
    onClick: () => console.log('Clicked'),
  },
};

export const Active: Story = {
  args: {
    label: 'Quick Start',
    icon: Zap,
    active: true,
    onClick: () => console.log('Clicked'),
  },
};

export const Disabled: Story = {
  args: {
    label: 'Quick Start',
    icon: Zap,
    active: false,
    disabled: true,
    onClick: () => console.log('Clicked'),
  },
};

export const PresetGroup: Story = {
  args: { label: '', icon: Zap, onClick: () => {}, active: false },
  render: () => {
    const [activePreset, setActivePreset] = useState<string>('comprehensive');

    return (
      <div className="flex flex-wrap gap-2">
        <PresetBadge
          label="Quick Start"
          icon={Zap}
          active={activePreset === 'quick'}
          onClick={() => setActivePreset('quick')}
        />
        <PresetBadge
          label="Self-Correcting"
          icon={Target}
          active={activePreset === 'self-correcting'}
          onClick={() => setActivePreset('self-correcting')}
        />
        <PresetBadge
          label="Comprehensive"
          icon={Rocket}
          active={activePreset === 'comprehensive'}
          onClick={() => setActivePreset('comprehensive')}
        />
      </div>
    );
  },
};

export const AllStates: Story = {
  args: { label: '', icon: Zap, onClick: () => {}, active: false },
  render: () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-500">Inactive</p>
        <PresetBadge label="Quick Start" icon={Zap} active={false} onClick={() => {}} />
      </div>
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-500">Active</p>
        <PresetBadge label="Self-Correcting" icon={Target} active={true} onClick={() => {}} />
      </div>
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-500">Disabled</p>
        <PresetBadge
          label="Comprehensive"
          icon={Rocket}
          active={false}
          disabled
          onClick={() => {}}
        />
      </div>
    </div>
  ),
};
