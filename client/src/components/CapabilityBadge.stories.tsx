import type { Meta, StoryObj } from '@storybook/react-vite';
import { CapabilityBadge } from './CapabilityBadge';

const meta = {
  title: 'Badges/CapabilityBadge',
  component: CapabilityBadge,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof CapabilityBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Code Generation capability badge (always enabled)
 */
export const CodeGeneration: Story = {
  args: {
    capability: 'codeGeneration',
  },
};

/**
 * Template Base capability badge
 */
export const TemplateBase: Story = {
  args: {
    capability: 'templateBase',
  },
};

/**
 * Smart Planning capability badge
 */
export const Planning: Story = {
  args: {
    capability: 'planning',
  },
};

/**
 * Auto Error-Fixing capability badge
 */
export const CompilerChecks: Story = {
  args: {
    capability: 'compilerChecks',
  },
};

/**
 * Building Blocks capability badge
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
    <div className="flex gap-2 flex-wrap">
      <CapabilityBadge capability="codeGeneration" />
      <CapabilityBadge capability="templateBase" />
      <CapabilityBadge capability="planning" />
      <CapabilityBadge capability="compilerChecks" />
      <CapabilityBadge capability="buildingBlocks" />
    </div>
  ),
  args: {
    capability: 'planning',
  },
};
