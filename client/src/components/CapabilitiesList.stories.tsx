import type { Meta, StoryObj } from '@storybook/react-vite';
import { CapabilitiesList } from './CapabilitiesList';

const meta = {
  title: 'Capabilities/CapabilitiesList',
  component: CapabilitiesList,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof CapabilitiesList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllEnabled: Story = {
  args: {
    capabilityConfig: {
      inputMode: 'template',
      planning: true,
      compilerChecks: true,
      buildingBlocks: true,
    },
  },
};

export const OnlyCodeGeneration: Story = {
  args: {
    capabilityConfig: {
      inputMode: 'prompt',
      planning: false,
      compilerChecks: false,
      buildingBlocks: false,
    },
  },
};

export const WithPlanning: Story = {
  args: {
    capabilityConfig: {
      inputMode: 'prompt',
      planning: true,
      compilerChecks: false,
      buildingBlocks: false,
    },
  },
};

export const WithCompilerChecks: Story = {
  args: {
    capabilityConfig: {
      inputMode: 'prompt',
      planning: false,
      compilerChecks: true,
      buildingBlocks: false,
    },
  },
};

export const WithTemplate: Story = {
  args: {
    capabilityConfig: {
      inputMode: 'template',
      planning: false,
      compilerChecks: false,
      buildingBlocks: false,
    },
  },
};

export const WithBuildingBlocks: Story = {
  args: {
    capabilityConfig: {
      inputMode: 'prompt',
      planning: false,
      compilerChecks: false,
      buildingBlocks: true,
    },
  },
};

export const MixedConfiguration: Story = {
  args: {
    capabilityConfig: {
      inputMode: 'template',
      planning: true,
      compilerChecks: false,
      buildingBlocks: true,
    },
  },
};
