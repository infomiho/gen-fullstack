import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from '@storybook/test';
import React from 'react';
import { PreviewControls } from './PreviewControls';

const meta = {
  title: 'App/PreviewControls',
  component: PreviewControls,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    onReload: {
      description: 'Callback when reload button is clicked',
      action: 'reload',
    },
    onToggleFullscreen: {
      description: 'Callback when fullscreen toggle is clicked',
      action: 'toggle fullscreen',
    },
    isFullscreen: {
      description: 'Whether preview is currently in fullscreen mode',
      control: 'boolean',
    },
  },
  args: {
    onReload: fn(),
    onToggleFullscreen: fn(),
  },
} satisfies Meta<typeof PreviewControls>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NotFullscreen: Story = {
  args: {
    isFullscreen: false,
  },
};

export const Fullscreen: Story = {
  args: {
    isFullscreen: true,
  },
};

// Interactive demo
export const Interactive: Story = {
  args: {
    isFullscreen: false,
  },
  render: () => {
    const [isFullscreen, setIsFullscreen] = React.useState(false);
    return (
      <div className="space-y-4">
        <PreviewControls
          onReload={() => alert('Reloading preview...')}
          onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
          isFullscreen={isFullscreen}
        />
        <p className="text-sm text-gray-600">
          {isFullscreen ? 'Fullscreen mode active' : 'Normal mode'}
        </p>
      </div>
    );
  },
};

// In context of header
export const InHeader: Story = {
  args: {
    isFullscreen: false,
  },
  render: () => (
    <div className="border-b border-border p-4 flex items-center justify-between bg-card">
      <h3 className="text-sm font-medium text-foreground">App Preview</h3>
      <PreviewControls onReload={() => {}} onToggleFullscreen={() => {}} isFullscreen={false} />
    </div>
  ),
};
