import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { FileEditorTabs } from './FileEditorTabs';
import { ToastProvider } from './ToastProvider';

// Mock window.confirm
const mockConfirm = vi.fn();
window.confirm = mockConfirm;

// Mock CodeEditor to avoid CodeMirror issues in jsdom
vi.mock('./CodeEditor', () => ({
  CodeEditor: ({
    value,
    onChange,
  }: {
    value: string;
    filePath: string;
    onChange?: (value: string) => void;
  }) => (
    <div data-testid="code-editor">
      <textarea
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        data-testid="editor-textarea"
      />
    </div>
  ),
}));

function renderWithToast(ui: React.ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>);
}

describe('FileEditorTabs', () => {
  beforeEach(() => {
    mockConfirm.mockClear();
  });

  describe('Tab Closing', () => {
    it('should close a tab when close button is clicked', async () => {
      const user = userEvent.setup();
      const files = [
        { path: 'src/App.tsx', content: 'console.log("app");' },
        { path: 'src/index.tsx', content: 'console.log("index");' },
      ];

      renderWithToast(<FileEditorTabs files={files} />);

      // Both tabs should be visible
      expect(screen.getByText('App.tsx')).toBeInTheDocument();
      expect(screen.getByText('index.tsx')).toBeInTheDocument();

      // Find close button for first tab (using aria-label)
      const closeButtons = screen.getAllByLabelText('Close tab');
      await user.click(closeButtons[0]);

      // First tab should be removed
      await waitFor(() => {
        expect(screen.queryByText('App.tsx')).not.toBeInTheDocument();
      });
      expect(screen.getByText('index.tsx')).toBeInTheDocument();
    });

    it('should switch to adjacent tab when closing active tab', async () => {
      const user = userEvent.setup();
      const files = [
        { path: 'src/App.tsx', content: 'app content' },
        { path: 'src/index.tsx', content: 'index content' },
        { path: 'src/utils.ts', content: 'utils content' },
      ];

      renderWithToast(<FileEditorTabs files={files} />);

      // First tab (App.tsx) should be active by default
      const appEditor = screen.getByTestId('editor-textarea');
      expect(appEditor).toHaveValue('app content');

      // Close the active tab
      const closeButtons = screen.getAllByLabelText('Close tab');
      await user.click(closeButtons[0]);

      // Should switch to the next tab (index.tsx was at index 1, now at 0)
      await waitFor(() => {
        expect(screen.queryByText('App.tsx')).not.toBeInTheDocument();
        const indexEditor = screen.getByTestId('editor-textarea');
        expect(indexEditor).toHaveValue('index content');
      });
    });

    it('should prompt for confirmation when closing tab with unsaved changes', async () => {
      const user = userEvent.setup();
      mockConfirm.mockReturnValue(false); // User cancels

      const files = [{ path: 'src/App.tsx', content: 'original content' }];

      renderWithToast(<FileEditorTabs files={files} />);

      // Make changes to the file using the mocked editor
      const editor = screen.getByTestId('editor-textarea');
      await user.clear(editor);
      await user.type(editor, 'modified content');

      // Wait for dirty indicator
      await waitFor(() => {
        expect(screen.getByText('●')).toBeInTheDocument(); // Dirty indicator
      });

      // Try to close the tab
      const closeButton = screen.getByLabelText('Close tab');
      await user.click(closeButton);

      // Confirm should be called
      expect(mockConfirm).toHaveBeenCalledWith(
        'You have unsaved changes in src/App.tsx. Close anyway?',
      );

      // Tab should still be there (user cancelled)
      expect(screen.getByText('App.tsx')).toBeInTheDocument();
    });

    it('should close tab with unsaved changes if user confirms', async () => {
      const user = userEvent.setup();
      mockConfirm.mockReturnValue(true); // User confirms

      const files = [
        { path: 'src/App.tsx', content: 'original content' },
        { path: 'src/index.tsx', content: 'index content' },
      ];

      renderWithToast(<FileEditorTabs files={files} />);

      // Make changes to the file using the mocked editor
      const editor = screen.getByTestId('editor-textarea');
      await user.clear(editor);
      await user.type(editor, 'modified content');

      // Wait for dirty indicator
      await waitFor(() => {
        expect(screen.getByText('●')).toBeInTheDocument();
      });

      // Close the tab
      const closeButtons = screen.getAllByLabelText('Close tab');
      await user.click(closeButtons[0]);

      // Confirm should be called
      expect(mockConfirm).toHaveBeenCalled();

      // Tab should be removed
      await waitFor(() => {
        expect(screen.queryByText('App.tsx')).not.toBeInTheDocument();
      });
    });

    it('should show empty state when closing last tab', async () => {
      const user = userEvent.setup();
      const files = [{ path: 'src/App.tsx', content: 'app content' }];

      renderWithToast(<FileEditorTabs files={files} />);

      // Close the only tab
      const closeButton = screen.getByLabelText('Close tab');
      await user.click(closeButton);

      // Should show empty state
      await waitFor(() => {
        expect(screen.getByText('No files open')).toBeInTheDocument();
        expect(screen.getByText('Select a file from the tree to open it')).toBeInTheDocument();
      });
    });

    it('should not trigger tab selection when clicking close button', async () => {
      const user = userEvent.setup();
      const files = [
        { path: 'src/App.tsx', content: 'app content' },
        { path: 'src/index.tsx', content: 'index content' },
      ];

      renderWithToast(<FileEditorTabs files={files} />);

      // First tab should be active
      const appEditor = screen.getByTestId('editor-textarea');
      expect(appEditor).toHaveValue('app content');

      // Click the second tab to make it active
      await user.click(screen.getByText('index.tsx'));
      await waitFor(() => {
        const indexEditor = screen.getByTestId('editor-textarea');
        expect(indexEditor).toHaveValue('index content');
      });

      // Now close the first (inactive) tab
      const closeButtons = screen.getAllByLabelText('Close tab');
      await user.click(closeButtons[0]);

      // Second tab should still be active (not switched)
      await waitFor(() => {
        expect(screen.queryByText('App.tsx')).not.toBeInTheDocument();
        const indexEditor = screen.getByTestId('editor-textarea');
        expect(indexEditor).toHaveValue('index content');
      });
    });
  });

  describe('Tab Opening', () => {
    it('should automatically focus newly opened file', async () => {
      const files = [{ path: 'src/App.tsx', content: 'app content' }];

      const { rerender } = renderWithToast(<FileEditorTabs files={files} />);

      // First file should be active
      const appEditor = screen.getByTestId('editor-textarea');
      expect(appEditor).toHaveValue('app content');

      // Add a new file to the files array
      const newFiles = [...files, { path: 'src/index.tsx', content: 'index content' }];

      rerender(
        <ToastProvider>
          <FileEditorTabs files={newFiles} />
        </ToastProvider>,
      );

      // New file should automatically become active
      await waitFor(() => {
        const indexEditor = screen.getByTestId('editor-textarea');
        expect(indexEditor).toHaveValue('index content');
      });

      // Both tabs should be visible
      expect(screen.getByText('App.tsx')).toBeInTheDocument();
      expect(screen.getByText('index.tsx')).toBeInTheDocument();
    });
  });

  describe('Tab Display', () => {
    it('should show dirty indicator for modified files', async () => {
      const user = userEvent.setup();
      const files = [{ path: 'src/App.tsx', content: 'original' }];

      renderWithToast(<FileEditorTabs files={files} />);

      // Initially no dirty indicator
      expect(screen.queryByText('●')).not.toBeInTheDocument();

      // Make changes using the mocked editor
      const editor = screen.getByTestId('editor-textarea');
      await user.type(editor, ' modified');

      // Dirty indicator should appear
      await waitFor(() => {
        expect(screen.getByText('●')).toBeInTheDocument();
      });
    });

    it('should truncate long file names', () => {
      const files = [
        {
          path: 'src/components/VeryLongFileNameThatShouldBeTruncated.tsx',
          content: 'content',
        },
      ];

      renderWithToast(<FileEditorTabs files={files} />);

      // Should show only the filename, not full path
      expect(screen.getByText('VeryLongFileNameThatShouldBeTruncated.tsx')).toBeInTheDocument();

      // Should have truncate class
      const tabName = screen.getByText('VeryLongFileNameThatShouldBeTruncated.tsx');
      expect(tabName).toHaveClass('truncate');
    });
  });
});
