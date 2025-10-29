import type { Meta, StoryObj } from '@storybook/react-vite';
import { CompletingContent } from './CompletingContent';

const meta = {
  title: 'Pipeline/CompletingContent',
  component: CompletingContent,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof CompletingContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithSummary: Story = {
  args: {
    summary: 'Successfully generated a full-stack todo app with authentication and database.',
  },
};

export const WithoutSummary: Story = {
  args: {
    summary: undefined,
  },
};
