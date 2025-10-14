import type { FileUpdate } from '@gen-fullstack/shared';

interface FileViewerProps {
  file: FileUpdate | null;
}

/**
 * FileViewer Component
 *
 * Displays the content of a selected file with basic syntax highlighting.
 * Currently shows plain text with monospace font.
 */
export function FileViewer({ file }: FileViewerProps) {
  if (!file) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        Select a file to view its contents
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* File header */}
      <div className="border-b px-4 py-2 bg-gray-50">
        <h3 className="text-xs font-mono text-gray-700">{file.path}</h3>
      </div>

      {/* File content */}
      <div className="flex-1 overflow-auto p-4">
        <pre className="text-xs font-mono text-gray-800 leading-relaxed">
          <code>{file.content}</code>
        </pre>
      </div>
    </div>
  );
}
