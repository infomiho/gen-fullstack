import type { Meta, StoryObj } from '@storybook/react-vite';
import { MetricsDisplay } from './MetricsDisplay';

const meta = {
  title: 'Session/MetricsDisplay',
  component: MetricsDisplay,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof MetricsDisplay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Typical: Story = {
  args: {
    totalTokens: 12345,
    cost: '0.0456',
    durationMs: 45678,
    stepCount: 42,
  },
};

export const SmallValues: Story = {
  args: {
    totalTokens: 1234,
    cost: '0.0012',
    durationMs: 5000,
    stepCount: 10,
  },
};

export const LargeValues: Story = {
  args: {
    totalTokens: 999999,
    cost: '2.4567',
    durationMs: 345678,
    stepCount: 150,
  },
};

export const FastGeneration: Story = {
  args: {
    totalTokens: 5000,
    cost: '0.0123',
    durationMs: 3456,
    stepCount: 18,
  },
};

export const SlowGeneration: Story = {
  args: {
    totalTokens: 50000,
    cost: '0.1234',
    durationMs: 234567,
    stepCount: 95,
  },
};

export const ExpensiveGeneration: Story = {
  args: {
    totalTokens: 150000,
    cost: '0.4567',
    durationMs: 123456,
    stepCount: 120,
  },
};

export const ZeroValues: Story = {
  args: {
    totalTokens: 0,
    cost: '0',
    durationMs: 0,
    stepCount: 0,
  },
};
