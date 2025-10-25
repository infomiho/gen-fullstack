import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { ToastProvider, useToast } from './ToastProvider';

/**
 * ToastProvider enables toast notifications throughout the app using Radix UI.
 * Redesigned with minimal color approach inspired by shadcn/ui Sonner.
 * Toasts auto-dismiss after 5 seconds and support success, error, warning, and info types.
 */
const meta: Meta<typeof ToastProvider> = {
  title: 'UI/Error Handling/ToastProvider',
  component: ToastProvider,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story: React.ComponentType) => (
      <ToastProvider>
        <Story />
      </ToastProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ToastProvider>;

function ToastDemo() {
  const { showToast } = useToast();
  const [count, setCount] = useState(0);

  return (
    <div className="space-y-4 p-8">
      <h3 className="font-semibold mb-4">Click buttons to show toasts</h3>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            setCount((c) => c + 1);
            showToast('Success!', `Operation completed successfully (${count + 1})`, 'success');
          }}
          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
        >
          Success
        </button>

        <button
          type="button"
          onClick={() => {
            setCount((c) => c + 1);
            showToast('Error!', `Something went wrong (${count + 1})`, 'error');
          }}
          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
        >
          Error
        </button>

        <button
          type="button"
          onClick={() => {
            setCount((c) => c + 1);
            showToast('Warning', `Please review this carefully (${count + 1})`, 'warning');
          }}
          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
        >
          Warning
        </button>

        <button
          type="button"
          onClick={() => {
            setCount((c) => c + 1);
            showToast('Info', `Here's some information (${count + 1})`, 'info');
          }}
          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
        >
          Info
        </button>
      </div>

      <div className="mt-4 text-sm text-gray-600">
        <p>• Minimal color design with icon-based differentiation</p>
        <p>• Auto-dismiss after 5 seconds</p>
        <p>• Swipe right to dismiss manually</p>
      </div>
    </div>
  );
}

/**
 * Interactive demo showing all toast types
 */
export const Default: Story = {
  render: () => <ToastDemo />,
};

function FileToastDemo() {
  const { showToast } = useToast();

  return (
    <div className="space-y-4 p-8">
      <h3 className="font-semibold mb-4">File Operation Toasts</h3>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => showToast('File saved', 'src/App.tsx', 'success')}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Save File
        </button>

        <button
          type="button"
          onClick={() => showToast('File deleted', 'src/components/OldComponent.tsx', 'error')}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
        >
          Delete File
        </button>
      </div>
    </div>
  );
}

/**
 * Toast notifications for file operations (as used in the app)
 */
export const FileOperations: Story = {
  render: () => <FileToastDemo />,
};

function MultipleToastsDemo() {
  const { showToast } = useToast();

  const showMultiple = () => {
    showToast('First toast', 'Starting process...', 'info');
    setTimeout(() => showToast('Second toast', 'Processing data...', 'info'), 500);
    setTimeout(() => showToast('Third toast', 'Almost done...', 'info'), 1000);
    setTimeout(() => showToast('Success!', 'All done!', 'success'), 1500);
  };

  return (
    <div className="space-y-4 p-8">
      <h3 className="font-semibold mb-4">Multiple Toasts</h3>
      <button
        type="button"
        onClick={showMultiple}
        className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors"
      >
        Show Sequential Toasts
      </button>
      <p className="text-sm text-gray-600 mt-4">Multiple toasts will stack vertically</p>
    </div>
  );
}

/**
 * Demonstration of multiple toasts appearing in sequence
 */
export const MultipleToasts: Story = {
  render: () => <MultipleToastsDemo />,
};
