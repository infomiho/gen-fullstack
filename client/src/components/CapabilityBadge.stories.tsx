import type { Meta, StoryObj } from '@storybook/react-vite';
import { CapabilityBadge } from './CapabilityBadge';

const meta = {
  title: 'Components/CapabilityBadge',
  component: CapabilityBadge,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof CapabilityBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Planning capability badge (purple)
 */
export const Planning: Story = {
  args: {
    capability: 'planning',
  },
};

/**
 * Compiler checks capability badge (orange)
 */
export const CompilerChecks: Story = {
  args: {
    capability: 'compilerChecks',
  },
};

/**
 * Building blocks capability badge (amber)
 */
export const BuildingBlocks: Story = {
  args: {
    capability: 'buildingBlocks',
  },
};

/**
 * All capability badges side by side
 */
export const AllCapabilities: Story = {
  render: () => (
    <div className="flex gap-2">
      <CapabilityBadge capability="planning" />
      <CapabilityBadge capability="compilerChecks" />
      <CapabilityBadge capability="buildingBlocks" />
    </div>
  ),
  args: {
    capability: 'planning',
  },
};
