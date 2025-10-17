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
import { vscodeLight } from '@uiw/codemirror-theme-vscode';
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

  // Update ref when onChange changes
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

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
        vscodeLight,
        EditorView.editable.of(!readOnly),
        EditorView.updateListener.of((update: ViewUpdate) => {
          // Use ref to get latest onChange callback
          if (update.docChanged && onChangeRef.current) {
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
  }, [filePath, readOnly, value]); // Re-create editor when file, readOnly, or value changes

  // Show error if file is too large
  if (fileTooLarge) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-red-50">
        <div className="text-center p-6 max-w-md">
          <p className="text-red-600 font-semibold mb-2">File Too Large</p>
          <p className="text-gray-700 text-sm mb-1">
            This file is {(value.length / 1_000_000).toFixed(2)}MB, which exceeds the{' '}
            {MAX_EDITOR_FILE_SIZE / 1_000_000}MB limit for in-browser editing.
          </p>
          <p className="text-gray-600 text-xs">
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
