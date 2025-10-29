import type { Meta, StoryObj } from '@storybook/react-vite';
import { CodeGenerationContent } from './CodeGenerationContent';

const meta = {
  title: 'Pipeline/CodeGenerationContent',
  component: CodeGenerationContent,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof CodeGenerationContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Started: Story = {
  args: {
    status: 'started',
  },
};

export const Completed: Story = {
  args: {
    status: 'completed',
  },
};

export const Failed: Story = {
  args: {
    status: 'failed',
  },
};
