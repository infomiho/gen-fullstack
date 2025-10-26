import type { Meta, StoryObj } from '@storybook/react-vite';
import { ToolItem } from './ToolItem';

const meta = {
  title: 'Timeline/ToolItem',
  component: ToolItem,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ToolItem>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Shows all tool types with their custom icons
 */
export const AllToolTypes: Story = {
  args: {
    tool: {
      id: '1',
      name: 'writeFile',
      args: { path: '/app/client/src/App.tsx' },
      isComplete: true,
      timestamp: Date.now(),
    },
    isOpen: false,
    onOpenChange: () => {},
  },
  render: (args) => (
    <div className="space-y-2">
      {/* File Operations */}
      <ToolItem
        {...args}
        tool={{
          ...args.tool,
          name: 'writeFile',
          args: { path: '/app/client/src/App.tsx', content: 'export default App' },
        }}
      />
      <ToolItem
        {...args}
        tool={{
          ...args.tool,
          name: 'readFile',
          args: { path: '/app/package.json' },
        }}
      />
      <ToolItem
        {...args}
        tool={{
          ...args.tool,
          name: 'getFileTree',
          args: { path: '/app/client/src' },
        }}
      />

      {/* Commands */}
      <ToolItem
        {...args}
        tool={{
          ...args.tool,
          name: 'executeCommand',
          args: { command: 'npm install react react-dom' },
        }}
      />
      <ToolItem
        {...args}
        tool={{
          ...args.tool,
          name: 'executeCommand',
          args: { command: 'pnpm add @radix-ui/react-dialog' },
        }}
      />
      <ToolItem
        {...args}
        tool={{
          ...args.tool,
          name: 'executeCommand',
          args: { command: 'ls -la' },
        }}
      />

      {/* Building Blocks & Architecture */}
      <ToolItem
        {...args}
        tool={{
          ...args.tool,
          name: 'requestBlock',
          args: { blockId: 'auth-password' },
        }}
      />
      <ToolItem
        {...args}
        tool={{
          ...args.tool,
          name: 'planArchitecture',
          args: { prompt: 'Build a todo app' },
        }}
      />

      {/* Validation */}
      <ToolItem
        {...args}
        tool={{
          ...args.tool,
          name: 'validatePrismaSchema',
          args: {},
        }}
      />
      <ToolItem
        {...args}
        tool={{
          ...args.tool,
          name: 'validateTypeScript',
          args: { target: 'both' },
        }}
      />

      {/* Package Management */}
      <ToolItem
        {...args}
        tool={{
          ...args.tool,
          name: 'installNpmDep',
          args: {
            target: 'client',
            dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' },
          },
        }}
      />

      {/* Unknown tool (fallback to Wrench) */}
      <ToolItem
        {...args}
        tool={{
          ...args.tool,
          name: 'unknownTool',
          args: {},
        }}
      />
    </div>
  ),
};

/**
 * Tool execution in progress (running state)
 */
export const Running: Story = {
  args: {
    tool: {
      id: '1',
      name: 'executeCommand',
      args: { command: 'npm install' },
      isComplete: false,
      timestamp: Date.now(),
    },
    isOpen: false,
    onOpenChange: () => {},
  },
};

/**
 * Completed tool with result
 */
export const Completed: Story = {
  args: {
    tool: {
      id: '1',
      name: 'readFile',
      args: { path: '/app/package.json' },
      result: '{\n  "name": "my-app",\n  "version": "1.0.0"\n}',
      isComplete: true,
      timestamp: Date.now(),
    },
    isOpen: false,
    onOpenChange: () => {},
  },
};

/**
 * Failed tool with error
 */
export const Failed: Story = {
  args: {
    tool: {
      id: '1',
      name: 'writeFile',
      args: { path: '/app/src/invalid.ts' },
      result: 'Error: Permission denied',
      isComplete: true,
      isError: true,
      timestamp: Date.now(),
    },
    isOpen: false,
    onOpenChange: () => {},
  },
};

/**
 * Tool with reason explanation
 */
export const WithReason: Story = {
  args: {
    tool: {
      id: '1',
      name: 'writeFile',
      args: { path: '/app/client/src/components/Button.tsx' },
      reason: 'Creating a reusable button component for the UI',
      result: 'File written successfully',
      isComplete: true,
      timestamp: Date.now(),
    },
    isOpen: false,
    onOpenChange: () => {},
  },
};

/**
 * Modal open state
 */
export const ModalOpen: Story = {
  args: {
    tool: {
      id: '1',
      name: 'validateTypeScript',
      args: {},
      result: 'No TypeScript errors found',
      isComplete: true,
      timestamp: Date.now(),
    },
    isOpen: true,
    onOpenChange: () => {},
  },
};
