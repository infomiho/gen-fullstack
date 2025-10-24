import type { LLMMessage, ToolCall, ToolResult } from '@gen-fullstack/shared';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Timeline } from './Timeline';

/**
 * Timeline displays a unified chronological view of LLM messages and tool calls.
 * Users can click on tool calls to view detailed parameters and results in a modal.
 */
const meta: Meta<typeof Timeline> = {
  title: 'UI/Timeline/Timeline',
  component: Timeline,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Timeline>;

const sampleMessages: LLMMessage[] = [
  {
    id: 'msg-1',
    role: 'user',
    content: 'Create a simple React counter app with TypeScript',
    timestamp: Date.now() - 10000,
  },
  {
    id: 'msg-2',
    role: 'assistant',
    content:
      "I'll create a React counter app for you with TypeScript. Let me start by creating the necessary files.",
    timestamp: Date.now() - 9000,
  },
  {
    id: 'msg-3',
    role: 'assistant',
    content:
      'I\'ve created a complete React counter app with TypeScript. The app includes:\n\n1. A main App component with state management\n2. TypeScript configuration\n3. Package.json with all dependencies\n\nYou can now run the app with "npm run dev".',
    timestamp: Date.now() - 2000,
  },
];

const sampleToolCalls: ToolCall[] = [
  {
    id: 'tool-1',
    name: 'writeFile',
    args: {
      path: 'package.json',
      content: '{\n  "name": "counter-app",\n  "type": "module"\n}',
    },
    timestamp: Date.now() - 8000,
  },
  {
    id: 'tool-2',
    name: 'writeFile',
    args: {
      path: 'src/App.tsx',
      content:
        'import { useState } from "react";\n\nexport default function App() {\n  const [count, setCount] = useState(0);\n  return <div>Count: {count}</div>;\n}',
    },
    timestamp: Date.now() - 6000,
  },
  {
    id: 'tool-3',
    name: 'writeFile',
    args: {
      path: 'tsconfig.json',
      content: '{\n  "compilerOptions": {\n    "target": "ES2020"\n  }\n}',
    },
    timestamp: Date.now() - 4000,
  },
];

const sampleToolResults: ToolResult[] = [
  {
    id: 'result-tool-1',
    toolName: 'writeFile',
    result: 'Successfully wrote to package.json',
    timestamp: Date.now() - 7500,
  },
  {
    id: 'result-tool-2',
    toolName: 'writeFile',
    result: 'Successfully wrote to src/App.tsx',
    timestamp: Date.now() - 5500,
  },
  {
    id: 'result-tool-3',
    toolName: 'writeFile',
    result: 'Successfully wrote to tsconfig.json',
    timestamp: Date.now() - 3500,
  },
];

/**
 * Empty state - no activity yet
 */
export const Empty: Story = {
  args: {
    messages: [],
    toolCalls: [],
    toolResults: [],
  },
};

/**
 * Only messages - no tool calls
 */
export const MessagesOnly: Story = {
  args: {
    messages: sampleMessages,
    toolCalls: [],
    toolResults: [],
  },
};

/**
 * Complete timeline with messages and tool executions
 */
export const Complete: Story = {
  args: {
    messages: sampleMessages,
    toolCalls: sampleToolCalls,
    toolResults: sampleToolResults,
  },
};

/**
 * Tool calls in progress (no results yet)
 */
export const InProgress: Story = {
  args: {
    messages: sampleMessages.slice(0, 2),
    toolCalls: sampleToolCalls,
    toolResults: [], // No results yet
  },
};

/**
 * Mixed tool types
 */
export const MixedTools: Story = {
  args: {
    messages: [sampleMessages[0], sampleMessages[1]],
    toolCalls: [
      {
        id: 'tool-read',
        name: 'readFile',
        args: { path: 'package.json' },
        timestamp: Date.now() - 8000,
      },
      {
        id: 'tool-list',
        name: 'listFiles',
        args: { directory: 'src' },
        timestamp: Date.now() - 6000,
      },
      {
        id: 'tool-exec',
        name: 'executeCommand',
        args: { command: 'npm install' },
        timestamp: Date.now() - 4000,
      },
      {
        id: 'tool-write',
        name: 'writeFile',
        args: {
          path: 'README.md',
          content: '# My App\n\nA simple React app.',
        },
        timestamp: Date.now() - 2000,
      },
    ],
    toolResults: [
      {
        id: 'result-tool-read',
        toolName: 'readFile',
        result: '{ "name": "my-app" }',
        timestamp: Date.now() - 7500,
      },
      {
        id: 'result-tool-list',
        toolName: 'listFiles',
        result: 'src/App.tsx\nsrc/index.tsx',
        timestamp: Date.now() - 5500,
      },
      {
        id: 'result-tool-exec',
        toolName: 'executeCommand',
        result: 'added 234 packages in 3s',
        timestamp: Date.now() - 3500,
      },
      {
        id: 'result-tool-write',
        toolName: 'writeFile',
        result: 'Successfully wrote to README.md',
        timestamp: Date.now() - 1500,
      },
    ],
  },
};

/**
 * Long conversation
 */
export const LongConversation: Story = {
  args: {
    messages: [
      ...sampleMessages,
      {
        id: 'msg-4',
        role: 'user',
        content: 'Add a reset button',
        timestamp: Date.now() - 1000,
      },
      {
        id: 'msg-5',
        role: 'assistant',
        content: "I'll add a reset button to the counter app.",
        timestamp: Date.now() - 500,
      },
    ],
    toolCalls: [
      ...sampleToolCalls,
      {
        id: 'tool-4',
        name: 'writeFile',
        args: {
          path: 'src/App.tsx',
          content:
            'import { useState } from "react";\n\nexport default function App() {\n  const [count, setCount] = useState(0);\n  return (\n    <div>\n      <p>Count: {count}</p>\n      <button onClick={() => setCount(count + 1)}>+</button>\n      <button onClick={() => setCount(0)}>Reset</button>\n    </div>\n  );\n}',
        },
        timestamp: Date.now() - 400,
      },
    ],
    toolResults: [
      ...sampleToolResults,
      {
        id: 'result-tool-4',
        toolName: 'writeFile',
        result: 'Successfully updated src/App.tsx',
        timestamp: Date.now() - 300,
      },
    ],
  },
};
