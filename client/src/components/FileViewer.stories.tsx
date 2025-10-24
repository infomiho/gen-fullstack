import type { Meta, StoryObj } from '@storybook/react-vite';
import { FileViewer } from './FileViewer';

/**
 * FileViewer displays file contents with syntax highlighting using CodeMirror in read-only mode.
 * It shows a file header with the path and the content below.
 */
const meta: Meta<typeof FileViewer> = {
  title: 'UI/Editor/FileViewer',
  component: FileViewer,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof FileViewer>;

const sampleReactFile = {
  path: 'src/App.tsx',
  content: `import { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="container">
      <h1>Welcome to My App</h1>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
    </div>
  );
}`,
};

const sampleJSONFile = {
  path: 'package.json',
  content: `{
  "name": "my-app",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}`,
};

const sampleCSSFile = {
  path: 'src/index.css',
  content: `.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

h1 {
  color: #333;
  font-size: 2rem;
  margin-bottom: 1rem;
}

button {
  background-color: #007bff;
  color: white;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background-color: #0056b3;
}`,
};

/**
 * No file selected - empty state
 */
export const Empty: Story = {
  args: {
    file: null,
  },
};

/**
 * Viewing a TypeScript React component
 */
export const TypeScriptFile: Story = {
  args: {
    file: sampleReactFile,
  },
};

/**
 * Viewing a JSON configuration file
 */
export const JSONFile: Story = {
  args: {
    file: sampleJSONFile,
  },
};

/**
 * Viewing a CSS stylesheet
 */
export const CSSFile: Story = {
  args: {
    file: sampleCSSFile,
  },
};

/**
 * Large file with scroll
 */
export const LargeFile: Story = {
  args: {
    file: {
      path: 'src/utils.ts',
      content: Array.from(
        { length: 100 },
        (_, i) => `export function util${i}() {\n  return ${i};\n}`,
      ).join('\n\n'),
    },
  },
};
