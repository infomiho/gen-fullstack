import type { FileUpdate } from '@gen-fullstack/shared';
import { useMemo } from 'react';

interface FileTreeProps {
  files: FileUpdate[];
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
}

/**
 * FileTree Component
 *
 * Displays a tree view of generated files organized by directory structure.
 * Files are grouped hierarchically with directories shown as collapsible sections.
 */
export function FileTree({ files, selectedFile, onSelectFile }: FileTreeProps) {
  // Build tree structure from flat file list
  const tree = useMemo(() => {
    const root: TreeNode = { name: '', type: 'directory', children: new Map(), path: '' };

    for (const file of files) {
      const parts = file.path.split('/');
      let current = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isFile = i === parts.length - 1;

        if (!current.children.has(part)) {
          current.children.set(part, {
            name: part,
            type: isFile ? 'file' : 'directory',
            children: new Map(),
            path: parts.slice(0, i + 1).join('/'),
          });
        }

        current = current.children.get(part)!;
      }
    }

    return root;
  }, [files]);

  if (files.length === 0) {
    return <div className="text-center py-12 text-gray-400 text-sm">No files generated yet</div>;
  }

  return (
    <div className="space-y-1">
      {Array.from(tree.children.values()).map((node) => (
        <TreeNodeComponent
          key={node.path}
          node={node}
          depth={0}
          selectedFile={selectedFile}
          onSelectFile={onSelectFile}
        />
      ))}
    </div>
  );
}

interface TreeNode {
  name: string;
  type: 'file' | 'directory';
  children: Map<string, TreeNode>;
  path: string;
}

interface TreeNodeComponentProps {
  node: TreeNode;
  depth: number;
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
}

function TreeNodeComponent({ node, depth, selectedFile, onSelectFile }: TreeNodeComponentProps) {
  if (node.type === 'file') {
    const isSelected = selectedFile === node.path;
    return (
      <button
        onClick={() => onSelectFile(node.path)}
        className={`w-full text-left px-2 py-1 text-xs font-mono rounded hover:bg-gray-100 transition-colors ${
          isSelected ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-700'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {node.name}
      </button>
    );
  }

  // Directory node
  return (
    <div>
      <div
        className="px-2 py-1 text-xs font-mono text-gray-500"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {node.name || '/'}
      </div>
      {Array.from(node.children.values()).map((child) => (
        <TreeNodeComponent
          key={child.path}
          node={child}
          depth={depth + 1}
          selectedFile={selectedFile}
          onSelectFile={onSelectFile}
        />
      ))}
    </div>
  );
}
