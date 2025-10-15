import type { FileUpdate } from '@gen-fullstack/shared';
import { typography } from '../lib/design-tokens';
import { CodeEditor } from './CodeEditor';

interface FileViewerProps {
  file: FileUpdate | null;
}

/**
 * FileViewer Component
 *
 * Displays the content of a selected file with syntax highlighting using CodeEditor in read-only mode.
 */
export function FileViewer({ file }: FileViewerProps) {
  if (!file) {
    return (
      <div className={`flex items-center justify-center h-full text-gray-400 ${typography.body}`}>
        Select a file to view its contents
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* File header */}
      <div className="border-b px-4 py-2 bg-gray-50">
        <h3 className={`${typography.mono} text-gray-700`}>{file.path}</h3>
      </div>

      {/* File content with syntax highlighting */}
      <div className="flex-1 overflow-hidden">
        <CodeEditor value={file.content} filePath={file.path} readOnly={true} />
      </div>
    </div>
  );
}
