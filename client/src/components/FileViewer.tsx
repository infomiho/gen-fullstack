import type { FileUpdate } from '@gen-fullstack/shared';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Type workaround for React 19 compatibility
// biome-ignore lint/suspicious/noExplicitAny: React 19 type mismatch in react-syntax-highlighter
const Highlighter = SyntaxHighlighter as any;

interface FileViewerProps {
  file: FileUpdate | null;
}

/**
 * FileViewer Component
 *
 * Displays the content of a selected file with syntax highlighting.
 */
export function FileViewer({ file }: FileViewerProps) {
  if (!file) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        Select a file to view its contents
      </div>
    );
  }

  // Detect language from file extension
  const getLanguage = (path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      js: 'javascript',
      jsx: 'jsx',
      ts: 'typescript',
      tsx: 'tsx',
      json: 'json',
      html: 'html',
      css: 'css',
      md: 'markdown',
      py: 'python',
      sh: 'bash',
      yml: 'yaml',
      yaml: 'yaml',
    };
    return langMap[ext || ''] || 'text';
  };

  return (
    <div className="h-full flex flex-col">
      {/* File header */}
      <div className="border-b px-4 py-2 bg-gray-50">
        <h3 className="text-xs font-mono text-gray-700">{file.path}</h3>
      </div>

      {/* File content with syntax highlighting */}
      <div className="flex-1 overflow-auto">
        <Highlighter
          language={getLanguage(file.path)}
          style={vscDarkPlus}
          showLineNumbers
          customStyle={{
            margin: 0,
            padding: '1rem',
            fontSize: '0.75rem',
            lineHeight: '1.5',
            background: '#1e1e1e',
          }}
        >
          {file.content}
        </Highlighter>
      </div>
    </div>
  );
}
