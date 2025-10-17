import type { Meta, StoryObj } from '@storybook/react';
import { Bot, FileText, FolderOpen, PackageOpen } from 'lucide-react';
import { EmptyState } from './EmptyState';

const meta = {
  title: 'Components/EmptyState',
  component: EmptyState,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    icon: {
      description: 'Icon to display (ReactNode)',
      control: false,
    },
    title: {
      description: 'Primary message',
      control: 'text',
    },
    description: {
      description: 'Optional secondary message',
      control: 'text',
    },
    action: {
      description: 'Optional action button or link',
      control: false,
    },
  },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithBotIcon: Story = {
  args: {
    icon: <Bot size={48} />,
    title: 'No messages yet',
    description: 'Start generating to see LLM interactions...',
  },
};

export const WithFileIcon: Story = {
  args: {
    icon: <FileText size={48} />,
    title: 'No files generated',
    description: 'Files will appear here as they are created',
  },
};

export const WithFolderIcon: Story = {
  args: {
    icon: <FolderOpen size={48} />,
    title: 'Empty directory',
    description: 'This directory contains no files',
  },
};

export const WithPackageIcon: Story = {
  args: {
    icon: <PackageOpen size={48} />,
    title: 'No logs yet',
    description: 'Container logs will appear here when the app starts',
  },
};

export const TitleOnly: Story = {
  args: {
    title: 'Nothing to display',
  },
};

export const WithAction: Story = {
  args: {
    icon: <Bot size={48} />,
    title: 'No app running',
    description: 'Click the button below to start your application',
    action: (
      <button
        type="button"
        className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
      >
        Start App
      </button>
    ),
  },
};

export const CustomStyling: Story = {
  args: {
    icon: <Bot size={32} />,
    title: 'Custom styled empty state',
    description: 'With custom className applied',
    className: 'bg-gray-50 rounded-lg p-8',
  },
  decorators: [
    // biome-ignore lint/suspicious/noExplicitAny: Storybook decorator type
    (Story: any) => (
      <div style={{ width: '400px', height: '300px' }}>
        <Story />
      </div>
    ),
  ],
};
