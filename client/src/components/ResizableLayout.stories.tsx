import type { Meta, StoryObj } from '@storybook/react-vite';
import { ResizableLayout } from './ResizableLayout';

/**
 * ResizableLayout provides a three-panel resizable layout using react-resizable-panels.
 * Users can drag the handles to resize panels. Used throughout the app for flexible layouts.
 */
const meta: Meta<typeof ResizableLayout> = {
  title: 'UI/Editor/ResizableLayout',
  component: ResizableLayout,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ResizableLayout>;

/**
 * Three-panel layout with sidebar, middle, and right panels
 */
export const ThreePanel: Story = {
  args: {
    sidebar: (
      <div className="h-full bg-blue-50 p-4 border-r">
        <h3 className="font-semibold mb-2">Sidebar</h3>
        <p className="text-sm text-gray-600">
          This is the left sidebar panel. Resize by dragging the handle.
        </p>
      </div>
    ),
    middle: (
      <div className="h-full bg-green-50 p-4">
        <h3 className="font-semibold mb-2">Middle Panel</h3>
        <p className="text-sm text-gray-600">This is the main content area in the middle.</p>
      </div>
    ),
    right: (
      <div className="h-full bg-purple-50 p-4 border-l">
        <h3 className="font-semibold mb-2">Right Panel</h3>
        <p className="text-sm text-gray-600">
          This is the right panel. Both handles are draggable.
        </p>
      </div>
    ),
  },
};

/**
 * Two-panel layout without right panel
 */
export const TwoPanel: Story = {
  args: {
    sidebar: (
      <div className="h-full bg-blue-50 p-4 border-r">
        <h3 className="font-semibold mb-2">Sidebar</h3>
        <p className="text-sm text-gray-600">Left sidebar panel</p>
      </div>
    ),
    middle: (
      <div className="h-full bg-green-50 p-4">
        <h3 className="font-semibold mb-2">Main Content</h3>
        <p className="text-sm text-gray-600">
          Main content takes up more space when right panel is hidden.
        </p>
      </div>
    ),
  },
};

/**
 * File explorer + editor layout (like SessionPage Files tab)
 */
export const FileExplorer: Story = {
  args: {
    sidebar: (
      <div className="h-full bg-muted p-4">
        <h3 className="font-semibold mb-3">File Tree</h3>
        <div className="space-y-1 text-sm">
          <div className="font-mono cursor-pointer hover:bg-accent px-2 py-1 rounded">
            📄 package.json
          </div>
          <div className="font-mono cursor-pointer hover:bg-accent px-2 py-1 rounded">📁 src/</div>
          <div className="font-mono cursor-pointer hover:bg-accent px-2 py-1 rounded ml-4">
            📄 App.tsx
          </div>
          <div className="font-mono cursor-pointer hover:bg-accent px-2 py-1 rounded ml-4">
            📄 index.tsx
          </div>
        </div>
      </div>
    ),
    middle: (
      <div className="h-full bg-card p-4">
        <div className="border-b pb-2 mb-4">
          <span className="font-mono text-sm text-muted-foreground">src/App.tsx</span>
        </div>
        <pre className="text-sm font-mono text-foreground">
          {`export default function App() {
  return (
    <div>
      <h1>My App</h1>
    </div>
  );
}`}
        </pre>
      </div>
    ),
  },
};

/**
 * Timeline + Preview layout (like SessionPage)
 */
export const TimelinePreview: Story = {
  args: {
    sidebar: (
      <div className="h-full bg-muted p-4">
        <h3 className="font-semibold mb-3">Controls</h3>
        <div className="space-y-2">
          <button
            type="button"
            className="w-full px-3 py-2 bg-primary text-primary-foreground rounded text-sm"
          >
            Strategy
          </button>
          <button type="button" className="w-full px-3 py-2 bg-blue-600 text-white rounded text-sm">
            Start App
          </button>
        </div>
      </div>
    ),
    middle: (
      <div className="h-full bg-card p-4">
        <h3 className="font-semibold mb-3">Timeline</h3>
        <div className="space-y-2">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded">
            <div className="text-xs text-muted-foreground mb-1">ASSISTANT</div>
            <div className="text-sm">I'll create your app...</div>
          </div>
          <div className="p-3 bg-muted border border-border rounded">
            <div className="text-xs text-muted-foreground mb-1">TOOL: writeFile</div>
            <div className="text-sm font-mono">Writing to src/App.tsx</div>
          </div>
        </div>
      </div>
    ),
    right: (
      <div className="h-full bg-background p-4 border-l border-border">
        <h3 className="font-semibold mb-3 text-foreground">App Preview</h3>
        <div className="bg-card rounded p-8 text-center border border-border">
          <h1 className="text-2xl font-bold mb-2">My App</h1>
          <p className="text-muted-foreground">Running on port 5173</p>
        </div>
      </div>
    ),
  },
};
