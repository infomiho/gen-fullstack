import type { Meta, StoryObj } from '@storybook/react-vite';
import { SessionMetadata } from './SessionMetadata';

const meta = {
  title: 'Components/SessionMetadata',
  component: SessionMetadata,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof SessionMetadata>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Naive session with no optional capabilities
 */
export const NaiveBasic: Story = {
  args: {
    capabilityConfig: JSON.stringify({
      inputMode: 'naive',
      planning: false,
      compilerChecks: false,
      buildingBlocks: false,
      maxIterations: 3,
    }),
    status: 'completed',
    createdAt: new Date(Date.now() - 37 * 60 * 1000).toISOString(), // 37 minutes ago
    durationMs: 154000, // 2m 34s
    stepCount: 12,
    totalTokens: 15234,
  },
};

/**
 * Naive with planning and compiler checks
 */
export const NaiveWithCapabilities: Story = {
  args: {
    capabilityConfig: JSON.stringify({
      inputMode: 'naive',
      planning: true,
      compilerChecks: true,
      buildingBlocks: false,
      maxIterations: 3,
    }),
    status: 'completed',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    durationMs: 192000, // 3m 12s
    stepCount: 18,
    totalTokens: 22400,
  },
};

/**
 * Template with planning
 */
export const TemplateWithPlanning: Story = {
  args: {
    capabilityConfig: JSON.stringify({
      inputMode: 'template',
      templateOptions: {
        templateName: 'vite-fullstack-base',
      },
      planning: true,
      compilerChecks: false,
      buildingBlocks: false,
      maxIterations: 3,
    }),
    status: 'completed',
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
    durationMs: 105000, // 1m 45s
    stepCount: 8,
    totalTokens: 8900,
  },
};

/**
 * Failed session
 */
export const FailedSession: Story = {
  args: {
    capabilityConfig: JSON.stringify({
      inputMode: 'naive',
      planning: false,
      compilerChecks: false,
      buildingBlocks: false,
      maxIterations: 3,
    }),
    status: 'failed',
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
    durationMs: 72000, // 1m 12s
    stepCount: 9,
    totalTokens: 11300,
  },
};

/**
 * Currently generating (no duration/tokens yet)
 */
export const Generating: Story = {
  args: {
    capabilityConfig: JSON.stringify({
      inputMode: 'naive',
      planning: true,
      compilerChecks: false,
      buildingBlocks: false,
      maxIterations: 3,
    }),
    status: 'generating',
    createdAt: new Date(Date.now() - 30 * 1000).toISOString(), // 30 seconds ago
    durationMs: undefined,
    stepCount: undefined,
    totalTokens: undefined,
  },
};

/**
 * All capabilities enabled
 */
export const AllCapabilities: Story = {
  args: {
    capabilityConfig: JSON.stringify({
      inputMode: 'template',
      templateOptions: {
        templateName: 'vite-fullstack-base',
      },
      planning: true,
      compilerChecks: true,
      buildingBlocks: true,
      maxIterations: 3,
    }),
    status: 'completed',
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
    durationMs: 243000, // 4m 3s
    stepCount: 24,
    totalTokens: 28700,
  },
};
