/**
 * FileWorkspace - Unified file tree and editor workspace
 *
 * Combines FileTree and FileEditorTabs with resizable panels
 * Provides Bolt.new-style file editing experience
 */

import type { FileUpdate } from '@gen-fullstack/shared';
import { useEffect, useState } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { ErrorBoundary } from './ErrorBoundary';
import { FileEditorTabs } from './FileEditorTabs';
import { FileTree } from './FileTree';

interface FileWorkspaceProps {
  files: FileUpdate[];
  onSaveFile: (path: string, content: string) => void;
}

export function FileWorkspace({ files, onSaveFile }: FileWorkspaceProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [openTabs, setOpenTabs] = useState<Array<{ path: string; content: string }>>([]);

  // Sync open tabs with incoming file updates
  // This prevents data loss when LLM updates a file that's currently open in the editor
  useEffect(() => {
    setOpenTabs((prevTabs) =>
      prevTabs.map((tab) => {
        const updatedFile = files.find((f) => f.path === tab.path);
        // Only update if the file exists and content has changed
        if (updatedFile && updatedFile.content !== tab.content) {
          return { path: tab.path, content: updatedFile.content };
        }
        return tab;
      }),
    );
  }, [files]);

  // Handle file selection from tree - open in tabs
  const handleSelectFile = (path: string) => {
    setSelectedFile(path);

    // Check if tab is already open
    const existingTab = openTabs.find((tab) => tab.path === path);
    if (existingTab) return;

    // Find file and open new tab
    const file = files.find((f) => f.path === path);
    if (file) {
      setOpenTabs((prev) => [...prev, { path: file.path, content: file.content }]);
    }
  };

  // Handle file save
  const handleSave = (path: string, content: string) => {
    onSaveFile(path, content);
  };

  // Handle tab close - remove from openTabs so it can be reopened
  const handleCloseTab = (path: string) => {
    setOpenTabs((prev) => prev.filter((tab) => tab.path !== path));
    if (selectedFile === path) {
      setSelectedFile(null);
    }
  };

  return (
    <ErrorBoundary>
      <PanelGroup direction="horizontal" className="h-full">
        {/* File tree panel */}
        <Panel defaultSize={20} minSize={15} maxSize={40}>
          <div className="h-full border-r overflow-y-auto">
            <div className="px-4 py-6">
              <FileTree files={files} selectedFile={selectedFile} onSelectFile={handleSelectFile} />
            </div>
          </div>
        </Panel>

        {/* Resize handle */}
        <PanelResizeHandle className="w-1 bg-gray-200 hover:bg-blue-500 transition-colors cursor-col-resize" />

        {/* Editor tabs panel */}
        <Panel defaultSize={80} minSize={60}>
          <FileEditorTabs
            files={openTabs}
            onSaveFile={handleSave}
            onCloseTab={handleCloseTab}
            activeFile={selectedFile ?? undefined}
          />
        </Panel>
      </PanelGroup>
    </ErrorBoundary>
  );
}
