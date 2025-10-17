import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { ToastProvider, useToast } from './ToastProvider';

/**
 * ToastProvider enables toast notifications throughout the app using Radix UI.
 * Toasts auto-dismiss after 5 seconds and support success, error, and info types.
 */
const meta: Meta<typeof ToastProvider> = {
  title: 'Components/ToastProvider',
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
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => {
            setCount((c) => c + 1);
            showToast('Success!', `Operation completed successfully (${count + 1})`, 'success');
          }}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
        >
          Show Success Toast
        </button>

        <button
          type="button"
          onClick={() => {
            setCount((c) => c + 1);
            showToast('Error!', `Something went wrong (${count + 1})`, 'error');
          }}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
        >
          Show Error Toast
        </button>

        <button
          type="button"
          onClick={() => {
            setCount((c) => c + 1);
            showToast('Info', `Here's some information (${count + 1})`, 'info');
          }}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Show Info Toast
        </button>
      </div>

      <div className="mt-4 text-sm text-gray-600">
        <p>Toasts will auto-dismiss after 5 seconds</p>
        <p>You can also swipe them to dismiss manually</p>
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
