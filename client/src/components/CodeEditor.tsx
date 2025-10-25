/**
 * CodeEditor - CodeMirror 6-based code editor
 *
 * Replaces react-syntax-highlighter with editable CodeMirror editor
 * Follows Bolt.new's code editing approach
 */

import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { EditorState } from '@codemirror/state';
import type { ViewUpdate } from '@codemirror/view';
import { MAX_EDITOR_FILE_SIZE } from '@gen-fullstack/shared';
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';
import { basicSetup, EditorView } from 'codemirror';
import { useEffect, useRef, useState } from 'react';

interface CodeEditorProps {
  value: string;
  filePath: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
}

/**
 * Get CodeMirror language extension based on file path
 */
function getLanguageExtension(filePath: string) {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
      return javascript({ jsx: true, typescript: ext.includes('ts') });
    case 'css':
      return css();
    case 'html':
      return html();
    case 'json':
      return json();
    default:
      return javascript();
  }
}

export function CodeEditor({ value, filePath, onChange, readOnly = false }: CodeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  // Use ref to always have latest onChange callback
  const onChangeRef = useRef(onChange);
  const [fileTooLarge, setFileTooLarge] = useState(false);
  // Track if change came from user typing (prevents recreation loop)
  const isUserChangeRef = useRef(false);
  // Track current theme
  const [isDarkMode, setIsDarkMode] = useState(() =>
    document.documentElement.classList.contains('dark'),
  );

  // Update ref when onChange changes
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Watch for theme changes
  useEffect(() => {
    const updateTheme = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  // Main editor creation effect - only recreate when file or readOnly changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: We intentionally exclude 'value' from dependencies to prevent recreation on every value change. Value updates are handled by a separate effect that uses transactions to preserve cursor position.
  useEffect(() => {
    if (!editorRef.current) return;

    // Check file size
    if (value.length > MAX_EDITOR_FILE_SIZE) {
      setFileTooLarge(true);
      return;
    }
    setFileTooLarge(false);

    // Create editor state
    const state = EditorState.create({
      doc: value,
      extensions: [
        basicSetup,
        getLanguageExtension(filePath),
        isDarkMode ? vscodeDark : vscodeLight,
        EditorView.editable.of(!readOnly),
        EditorView.updateListener.of((update: ViewUpdate) => {
          // Use ref to get latest onChange callback
          if (update.docChanged && onChangeRef.current) {
            // Mark this as a user-initiated change
            isUserChangeRef.current = true;
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        EditorView.theme({
          '&': {
            height: '100%',
            fontSize: '14px',
            fontFamily:
              'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
          },
          '.cm-scroller': {
            overflow: 'auto',
          },
        }),
      ],
    });

    // Create editor view
    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    viewRef.current = view;

    // Cleanup
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [filePath, readOnly, isDarkMode]); // Recreate when file, readOnly, or theme changes

  // Separate effect for handling external value updates (not from user typing)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    // Skip update if this was a user-initiated change (avoid loop)
    if (isUserChangeRef.current) {
      isUserChangeRef.current = false;
      return;
    }

    // Only update if the value actually differs from editor content
    const currentContent = view.state.doc.toString();
    if (value !== currentContent) {
      // Update document without recreating the editor, preserving cursor position when possible
      const transaction = view.state.update({
        changes: { from: 0, to: currentContent.length, insert: value },
      });
      view.dispatch(transaction);
    }
  }, [value]);

  // Show error if file is too large
  if (fileTooLarge) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-red-50 dark:bg-red-950/30">
        <div className="text-center p-6 max-w-md">
          <p className="text-red-600 dark:text-red-400 font-semibold mb-2">File Too Large</p>
          <p className="text-foreground text-sm mb-1">
            This file is {(value.length / 1_000_000).toFixed(2)}MB, which exceeds the{' '}
            {MAX_EDITOR_FILE_SIZE / 1_000_000}MB limit for in-browser editing.
          </p>
          <p className="text-muted-foreground text-xs">
            Large files can cause browser performance issues. Consider editing this file in your
            local editor.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-hidden">
      <div ref={editorRef} className="h-full" />
    </div>
  );
}
