/**
 * FileEditorTabs - Multi-file tabbed editor using Radix Tabs
 *
 * Allows editing multiple files in tabs with save functionality
 * Inspired by Bolt.new's tab management
 */

import * as Tabs from '@radix-ui/react-tabs';
import { Save, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { CodeEditor } from './CodeEditor';
import { focus, radius, transitions, typography } from '../lib/design-tokens';
import { useToast } from './ToastProvider';

interface FileTab {
  path: string;
  content: string;
  isDirty?: boolean;
}

interface FileEditorTabsProps {
  files: Array<{ path: string; content: string }>;
  onSaveFile?: (path: string, content: string) => void;
  onCloseTab?: (path: string) => void;
}

export function FileEditorTabs({ files, onSaveFile, onCloseTab }: FileEditorTabsProps) {
  const { showToast } = useToast();
  const [openTabs, setOpenTabs] = useState<FileTab[]>([]);
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined);

  // Track previous files prop to detect newly added files
  const prevFilesRef = React.useRef<Set<string>>(new Set());

  // Sync open tabs with files prop - only open newly added files
  useEffect(() => {
    // Find files that are newly added to the files prop (not in previous render)
    const newlyAddedFiles = files.filter((file) => !prevFilesRef.current.has(file.path));

    // Update the ref with current file paths for next render
    prevFilesRef.current = new Set(files.map((f) => f.path));

    // Only open files that are both newly added AND not already open
    setOpenTabs((currentTabs) => {
      const currentPaths = new Set(currentTabs.map((t) => t.path));
      const filesToOpen = newlyAddedFiles.filter((file) => !currentPaths.has(file.path));

      if (filesToOpen.length > 0) {
        // Activate the first newly opened tab
        setActiveTab(filesToOpen[0].path);
        return [
          ...currentTabs,
          ...filesToOpen.map((f) => ({ path: f.path, content: f.content, isDirty: false })),
        ];
      }

      return currentTabs;
    });
  }, [files]);

  // Close a tab
  const closeTab = (path: string) => {
    const tab = openTabs.find((t) => t.path === path);
    if (tab?.isDirty) {
      if (!confirm(`You have unsaved changes in ${path}. Close anyway?`)) {
        return;
      }
    }

    setOpenTabs((prev) => {
      const filtered = prev.filter((tab) => tab.path !== path);
      // If closing active tab, switch to adjacent tab
      if (activeTab === path && filtered.length > 0) {
        const closedIndex = prev.findIndex((tab) => tab.path === path);
        const newActive = filtered[Math.max(0, closedIndex - 1)];
        setActiveTab(newActive.path);
      } else if (filtered.length === 0) {
        setActiveTab(undefined);
      }
      return filtered;
    });

    // Notify parent that tab was closed
    onCloseTab?.(path);
  };

  // Update tab content
  const updateTabContent = (path: string, content: string) => {
    setOpenTabs((prev) =>
      prev.map((tab) => (tab.path === path ? { ...tab, content, isDirty: true } : tab)),
    );
  };

  // Save file
  const saveFile = (path: string) => {
    const tab = openTabs.find((t) => t.path === path);
    if (!tab) return;

    if (onSaveFile) {
      onSaveFile(path, tab.content);
      setOpenTabs((prev) => prev.map((t) => (t.path === path ? { ...t, isDirty: false } : t)));
      showToast('File saved', path, 'success');
    }
  };

  // Keyboard shortcut for save
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      if (activeTab) {
        saveFile(activeTab);
      }
    }
  };

  if (openTabs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <div className="text-center">
          <p className={typography.body}>No files open</p>
          <p className={typography.caption}>Select a file from the tree to open it</p>
        </div>
      </div>
    );
  }

  return (
    <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
      {/* Tab list */}
      <Tabs.List className="flex items-center gap-1 border-b bg-gray-50 px-2 py-1 overflow-x-auto">
        {openTabs.map((tab) => (
          <Tabs.Trigger
            key={tab.path}
            value={tab.path}
            className={`
              group flex items-center gap-2 px-3 py-1.5 ${radius.sm} ${transitions.colors} ${focus.ring}
              data-[state=active]:bg-white data-[state=active]:shadow-sm
              data-[state=inactive]:hover:bg-gray-100
            `}
          >
            <span className={`${typography.label} truncate max-w-[150px]`}>
              {tab.path.split('/').pop()}
            </span>
            {tab.isDirty && <span className="text-blue-500">●</span>}
            {/* biome-ignore lint/a11y/useSemanticElements: Cannot use button here as Tabs.Trigger renders as button and HTML forbids nested buttons */}
            <span
              role="button"
              tabIndex={0}
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                closeTab(tab.path);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  closeTab(tab.path);
                }
              }}
              className={`
                p-0.5 ${radius.sm} ${transitions.colors}
                opacity-0 group-hover:opacity-100
                hover:bg-gray-200 cursor-pointer
              `}
              aria-label="Close tab"
            >
              <X className="h-3 w-3" />
            </span>
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      {/* Tab content */}
      {openTabs.map((tab) => (
        <Tabs.Content
          key={tab.path}
          value={tab.path}
          className="flex-1 overflow-hidden focus:outline-none"
          onKeyDown={handleKeyDown}
        >
          <div className="h-full flex flex-col">
            {/* Toolbar */}
            <div className="flex items-center justify-between border-b px-3 py-2 bg-white">
              <span className={`${typography.caption} text-gray-600`}>{tab.path}</span>
              <button
                type="button"
                onClick={() => saveFile(tab.path)}
                disabled={!tab.isDirty}
                className={`
                  flex items-center gap-2 px-3 py-1 text-sm font-medium ${radius.sm} ${transitions.colors} ${focus.ring}
                  ${tab.isDirty ? 'bg-gray-900 text-white hover:bg-gray-800' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}
                `}
              >
                <Save className="h-4 w-4" />
                <span>Save {tab.isDirty && '(Cmd/Ctrl+S)'}</span>
              </button>
            </div>

            {/* Editor */}
            <div className="flex-1 overflow-hidden">
              <CodeEditor
                value={tab.content}
                filePath={tab.path}
                onChange={(content) => updateTabContent(tab.path, content)}
              />
            </div>
          </div>
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}
