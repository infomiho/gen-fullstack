import type { Meta, StoryObj } from '@storybook/react-vite';
import { CodeEditor } from './CodeEditor';
import { useState } from 'react';

/**
 * CodeEditor provides a CodeMirror 6-based code editor with syntax highlighting.
 * Supports TypeScript, JavaScript, JSON, CSS, HTML, and more.
 */
const meta: Meta<typeof CodeEditor> = {
  title: 'Components/CodeEditor',
  component: CodeEditor,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof CodeEditor>;

const sampleTSX = `import { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="container">
      <h1>Counter App</h1>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
    </div>
  );
}`;

const sampleJSON = `{
  "name": "my-app",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}`;

const sampleCSS = `.container {
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
  transition: background-color 0.2s;
}

button:hover {
  background-color: #0056b3;
}`;

/**
 * Editable TypeScript React component
 */
export const TypeScriptEditable: Story = {
  args: {
    value: sampleTSX,
    filePath: 'src/App.tsx',
    onChange: (_value: string) => {},
    readOnly: false,
  },
};

/**
 * Read-only TypeScript file
 */
export const TypeScriptReadOnly: Story = {
  args: {
    value: sampleTSX,
    filePath: 'src/App.tsx',
    readOnly: true,
  },
};

/**
 * JSON configuration file
 */
export const JSONFile: Story = {
  args: {
    value: sampleJSON,
    filePath: 'package.json',
    onChange: (_value: string) => {},
    readOnly: false,
  },
};

/**
 * CSS stylesheet
 */
export const CSSFile: Story = {
  args: {
    value: sampleCSS,
    filePath: 'src/index.css',
    onChange: (_value: string) => {},
    readOnly: false,
  },
};

/**
 * Empty file - starting from scratch
 */
export const Empty: Story = {
  args: {
    value: '',
    filePath: 'src/NewComponent.tsx',
    onChange: (_value: string) => {},
    readOnly: false,
  },
};

/**
 * Interactive demo with state management
 */
function InteractiveDemo() {
  const [code, setCode] = useState(sampleTSX);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="h-screen flex flex-col">
      <div className="flex items-center justify-between border-b px-4 py-2 bg-white">
        <span className="text-sm font-mono text-gray-600">src/App.tsx</span>
        <button
          type="button"
          onClick={handleSave}
          className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
        >
          {saved ? '✓ Saved' : 'Save'}
        </button>
      </div>
      <div className="flex-1">
        <CodeEditor value={code} filePath="src/App.tsx" onChange={setCode} readOnly={false} />
      </div>
    </div>
  );
}

export const Interactive: Story = {
  render: () => <InteractiveDemo />,
};
