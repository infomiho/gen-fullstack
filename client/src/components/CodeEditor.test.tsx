import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { CodeEditor } from './CodeEditor';

// Use vi.hoisted() to create variables that can be safely used in both the mock and tests
const {
  mockDestroy,
  mockDispatch,
  mockStateUpdate,
  MockEditorViewClass,
  setMockDocContent,
  getMockUpdateListener,
  setMockUpdateListener,
} = vi.hoisted(() => {
  let mockDocContent = '';
  let mockUpdateListener: ((update: any) => void) | null = null;

  const mockDestroy = vi.fn();
  const mockDispatch = vi.fn();
  const mockStateUpdate = vi.fn();

  const MockEditorViewClass = vi.fn().mockImplementation((config) => {
    // Capture the update listener from extensions
    const extensions = config.state.extensions || [];
    for (const ext of extensions) {
      if (ext && typeof ext === 'object' && 'updateListener' in ext) {
        mockUpdateListener = ext.updateListener;
        break;
      }
    }

    return {
      destroy: mockDestroy,
      dispatch: mockDispatch,
      state: {
        doc: {
          toString: () => mockDocContent,
          get length() {
            return mockDocContent.length;
          },
        },
        update: mockStateUpdate,
      },
    };
  });

  // Add static methods to mock EditorView using Object.assign
  Object.assign(MockEditorViewClass, {
    editable: {
      of: vi.fn((value: boolean) => ({ editable: value })),
    },
    updateListener: {
      of: vi.fn((listener: any) => ({ updateListener: listener })),
    },
    theme: vi.fn((spec: any) => ({ theme: spec })),
  });

  return {
    mockDestroy,
    mockDispatch,
    mockStateUpdate,
    MockEditorViewClass,
    setMockDocContent: (value: string) => {
      mockDocContent = value;
    },
    getMockUpdateListener: () => mockUpdateListener,
    setMockUpdateListener: (listener: ((update: any) => void) | null) => {
      mockUpdateListener = listener;
    },
  };
});

// Mock CodeMirror
vi.mock('codemirror', () => {
  return {
    EditorView: MockEditorViewClass,
    basicSetup: {},
  };
});

vi.mock('@codemirror/state', () => ({
  EditorState: {
    create: vi.fn((config) => ({
      doc: config.doc,
      extensions: config.extensions,
    })),
  },
}));

vi.mock('@codemirror/lang-javascript', () => ({
  javascript: vi.fn(() => ({})),
}));

vi.mock('@codemirror/lang-css', () => ({
  css: vi.fn(() => ({})),
}));

vi.mock('@codemirror/lang-html', () => ({
  html: vi.fn(() => ({})),
}));

vi.mock('@codemirror/lang-json', () => ({
  json: vi.fn(() => ({})),
}));

vi.mock('@uiw/codemirror-theme-vscode', () => ({
  vscodeLight: {},
}));

describe('CodeEditor', () => {
  beforeEach(() => {
    mockDestroy.mockClear();
    mockDispatch.mockClear();
    mockStateUpdate.mockClear();
    mockStateUpdate.mockReturnValue({ changes: [] });
    setMockDocContent('');
    setMockUpdateListener(null);
  });

  describe('Editor Creation', () => {
    it('should create editor on mount', () => {
      render(<CodeEditor value="initial content" filePath="test.ts" />);

      expect(MockEditorViewClass).toHaveBeenCalledTimes(1);
    });

    it('should not recreate editor when value changes (user typing)', () => {
      MockEditorViewClass.mockClear();

      const onChange = vi.fn();
      const { rerender } = render(
        <CodeEditor value="initial" filePath="test.ts" onChange={onChange} />,
      );

      expect(MockEditorViewClass).toHaveBeenCalledTimes(1);
      expect(mockDestroy).not.toHaveBeenCalled();

      // Simulate user typing (value change from parent)
      rerender(<CodeEditor value="initial modified" filePath="test.ts" onChange={onChange} />);

      // Editor should NOT be recreated (destroy not called)
      expect(mockDestroy).not.toHaveBeenCalled();
      expect(MockEditorViewClass).toHaveBeenCalledTimes(1);
    });

    it('should recreate editor when filePath changes', () => {
      MockEditorViewClass.mockClear();

      const { rerender } = render(<CodeEditor value="content" filePath="test.ts" />);

      expect(MockEditorViewClass).toHaveBeenCalledTimes(1);

      // Change file path
      rerender(<CodeEditor value="content" filePath="other.ts" />);

      // Editor should be recreated (destroyed then created again)
      expect(mockDestroy).toHaveBeenCalledTimes(1);
      expect(MockEditorViewClass).toHaveBeenCalledTimes(2);
    });

    it('should recreate editor when readOnly changes', () => {
      MockEditorViewClass.mockClear();

      const { rerender } = render(
        <CodeEditor value="content" filePath="test.ts" readOnly={false} />,
      );

      expect(MockEditorViewClass).toHaveBeenCalledTimes(1);

      // Change readOnly
      rerender(<CodeEditor value="content" filePath="test.ts" readOnly={true} />);

      // Editor should be recreated
      expect(mockDestroy).toHaveBeenCalledTimes(1);
      expect(MockEditorViewClass).toHaveBeenCalledTimes(2);
    });
  });

  describe('Value Updates', () => {
    it('should update editor content via transaction when value changes externally', () => {
      setMockDocContent('initial');

      const { rerender } = render(<CodeEditor value="initial" filePath="test.ts" />);

      // Simulate external value change (not from user typing)
      // NOTE: Don't update mockDocContent yet - the editor's internal state should still be "initial"
      rerender(<CodeEditor value="external update" filePath="test.ts" />);

      // Should dispatch transaction to update content
      expect(mockStateUpdate).toHaveBeenCalledWith({
        changes: { from: 0, to: 'initial'.length, insert: 'external update' },
      });
      expect(mockDispatch).toHaveBeenCalled();
    });

    it('should not update editor if content is the same', () => {
      setMockDocContent('same content');

      const { rerender } = render(<CodeEditor value="same content" filePath="test.ts" />);

      mockDispatch.mockClear();
      mockStateUpdate.mockClear();

      // Re-render with same value
      rerender(<CodeEditor value="same content" filePath="test.ts" />);

      // Should not dispatch any transaction
      expect(mockStateUpdate).not.toHaveBeenCalled();
      expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('should skip update when change came from user typing', () => {
      setMockDocContent('initial');

      const onChange = vi.fn();
      const { rerender } = render(
        <CodeEditor value="initial" filePath="test.ts" onChange={onChange} />,
      );

      // Simulate user typing by calling the update listener
      const updateListener = getMockUpdateListener();
      if (updateListener) {
        updateListener({
          docChanged: true,
          state: { doc: { toString: () => 'initial typed' } },
        });
      }

      expect(onChange).toHaveBeenCalledWith('initial typed');

      mockDispatch.mockClear();
      mockStateUpdate.mockClear();

      // Parent re-renders with the new value
      setMockDocContent('initial typed');
      rerender(<CodeEditor value="initial typed" filePath="test.ts" onChange={onChange} />);

      // Should NOT dispatch transaction (this was user's change, not external)
      expect(mockStateUpdate).not.toHaveBeenCalled();
      expect(mockDispatch).not.toHaveBeenCalled();
    });
  });

  describe('Change Handling', () => {
    it('should call onChange when user types', () => {
      const onChange = vi.fn();
      render(<CodeEditor value="initial" filePath="test.ts" onChange={onChange} />);

      // Simulate user typing
      const updateListener = getMockUpdateListener();
      if (updateListener) {
        updateListener({
          docChanged: true,
          state: { doc: { toString: () => 'initial modified' } },
        });
      }

      expect(onChange).toHaveBeenCalledWith('initial modified');
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('should not call onChange when document did not change', () => {
      const onChange = vi.fn();
      render(<CodeEditor value="initial" filePath="test.ts" onChange={onChange} />);

      // Simulate update without document change (e.g., cursor movement)
      const updateListener = getMockUpdateListener();
      if (updateListener) {
        updateListener({
          docChanged: false,
          state: { doc: { toString: () => 'initial' } },
        });
      }

      expect(onChange).not.toHaveBeenCalled();
    });

    it('should update onChange callback without recreating editor', () => {
      MockEditorViewClass.mockClear();

      const onChange1 = vi.fn();
      const { rerender } = render(
        <CodeEditor value="content" filePath="test.ts" onChange={onChange1} />,
      );

      expect(MockEditorViewClass).toHaveBeenCalledTimes(1);

      // Change onChange callback
      const onChange2 = vi.fn();
      rerender(<CodeEditor value="content" filePath="test.ts" onChange={onChange2} />);

      // Editor should NOT be recreated
      expect(mockDestroy).not.toHaveBeenCalled();
      expect(MockEditorViewClass).toHaveBeenCalledTimes(1);

      // New callback should be used
      const updateListener = getMockUpdateListener();
      if (updateListener) {
        updateListener({
          docChanged: true,
          state: { doc: { toString: () => 'content modified' } },
        });
      }

      expect(onChange1).not.toHaveBeenCalled();
      expect(onChange2).toHaveBeenCalledWith('content modified');
    });
  });

  describe('File Size Handling', () => {
    it('should show error for files exceeding size limit', () => {
      const largeContent = 'x'.repeat(2_000_001); // > 2MB

      const { container } = render(<CodeEditor value={largeContent} filePath="large.ts" />);

      expect(container.textContent).toContain('File Too Large');
      expect(container.textContent).toContain('2.00MB');
    });

    it('should render editor for files within size limit', () => {
      MockEditorViewClass.mockClear();

      const normalContent = 'x'.repeat(1_000_000); // 1MB

      render(<CodeEditor value={normalContent} filePath="normal.ts" />);

      expect(MockEditorViewClass).toHaveBeenCalledTimes(1);
    });
  });

  describe('ReadOnly Mode', () => {
    it('should support readOnly prop', () => {
      render(<CodeEditor value="content" filePath="test.ts" readOnly={true} />);

      // Editor should be created (tested by not throwing)
      expect(MockEditorViewClass).toHaveBeenCalled();
    });

    it('should allow toggling readOnly', () => {
      MockEditorViewClass.mockClear();

      const { rerender } = render(
        <CodeEditor value="content" filePath="test.ts" readOnly={false} />,
      );

      expect(MockEditorViewClass).toHaveBeenCalledTimes(1);

      // Toggle readOnly
      rerender(<CodeEditor value="content" filePath="test.ts" readOnly={true} />);

      // Editor should be recreated
      expect(mockDestroy).toHaveBeenCalledTimes(1);
      expect(MockEditorViewClass).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cleanup', () => {
    it('should destroy editor on unmount', () => {
      const { unmount } = render(<CodeEditor value="content" filePath="test.ts" />);

      expect(mockDestroy).not.toHaveBeenCalled();

      unmount();

      expect(mockDestroy).toHaveBeenCalledTimes(1);
    });

    it('should destroy old editor before creating new one on file change', () => {
      MockEditorViewClass.mockClear();

      const { rerender } = render(<CodeEditor value="content" filePath="test.ts" />);

      expect(MockEditorViewClass).toHaveBeenCalledTimes(1);
      expect(mockDestroy).toHaveBeenCalledTimes(0);

      // Change file
      rerender(<CodeEditor value="content" filePath="other.ts" />);

      // Should destroy old, create new
      expect(mockDestroy).toHaveBeenCalledTimes(1);
      expect(MockEditorViewClass).toHaveBeenCalledTimes(2);
    });
  });
});
