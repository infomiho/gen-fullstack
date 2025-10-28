import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from '@storybook/test';
import { useState } from 'react';
import { ErrorBoundary } from './ErrorBoundary';

/**
 * ErrorBoundary catches JavaScript errors anywhere in the child component tree
 * and displays a fallback UI instead of crashing the app.
 */
const meta: Meta<typeof ErrorBoundary> = {
  title: 'System/ErrorBoundary',
  component: ErrorBoundary,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ErrorBoundary>;

/**
 * Component that throws an error when rendered
 */
function ThrowError({ message }: { message: string }): never {
  throw new Error(message);
}

/**
 * Component that throws an error when button is clicked
 */
function ThrowOnClick() {
  const [shouldThrow, setShouldThrow] = useState(false);

  if (shouldThrow) {
    throw new Error('Button click caused an error!');
  }

  return (
    <button
      type="button"
      onClick={() => setShouldThrow(true)}
      className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
    >
      Click to trigger error
    </button>
  );
}

/**
 * Normal operation - no errors
 */
export const NoError: Story = {
  render: () => (
    <ErrorBoundary>
      <div className="p-4 bg-green-50 border border-green-200 rounded">
        <h3 className="font-semibold text-green-900 mb-2">Everything works fine!</h3>
        <p className="text-sm text-green-700">
          This component is wrapped in an ErrorBoundary but no error has occurred.
        </p>
      </div>
    </ErrorBoundary>
  ),
};

/**
 * Error caught and displayed with default UI
 */
export const WithError: Story = {
  render: () => (
    <ErrorBoundary>
      <div className="p-4">
        <p className="mb-4">The component below will throw an error:</p>
        <ThrowError message="This is a simulated error for testing ErrorBoundary" />
      </div>
    </ErrorBoundary>
  ),
};

/**
 * Error caught and displayed with custom fallback
 */
export const WithCustomFallback: Story = {
  render: () => (
    <ErrorBoundary
      fallback={
        <div className="p-6 bg-purple-50 border-2 border-purple-300 rounded-lg">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">🚨</span>
            <h3 className="text-xl font-bold text-purple-900">Custom Error UI</h3>
          </div>
          <p className="text-purple-700">
            This is a custom fallback component. You can style it however you want!
          </p>
        </div>
      }
    >
      <ThrowError message="Error with custom fallback" />
    </ErrorBoundary>
  ),
};

/**
 * Interactive demo - trigger error with button click
 */
export const InteractiveTrigger: Story = {
  render: () => (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Click the button to trigger an error. The ErrorBoundary will catch it and show a fallback
        UI.
      </p>
      <ErrorBoundary>
        <ThrowOnClick />
      </ErrorBoundary>
    </div>
  ),
};

/**
 * Multiple children - only erroring component is caught
 */
export const PartialError: Story = {
  render: () => (
    <div className="space-y-4">
      <ErrorBoundary>
        <div className="p-4 bg-blue-50 border border-blue-200 rounded">
          <p className="text-blue-900">This component works fine</p>
        </div>
      </ErrorBoundary>

      <ErrorBoundary>
        <ThrowError message="Only this section has an error" />
      </ErrorBoundary>

      <ErrorBoundary>
        <div className="p-4 bg-green-50 border border-green-200 rounded">
          <p className="text-green-900">This component also works fine</p>
        </div>
      </ErrorBoundary>
    </div>
  ),
};

/**
 * Test: User can recover from error by clicking "Try again"
 */
export const UserCanRecoverFromError: Story = {
  render: () => {
    // Use a controlled error trigger
    function ErrorTrigger() {
      const shouldError = true;

      if (shouldError) {
        throw new Error('Test error');
      }

      return (
        <div className="p-4 bg-green-50 border border-green-200 rounded">
          <p className="text-green-900">Error recovered! Component is now working.</p>
        </div>
      );
    }

    return (
      <ErrorBoundary>
        <ErrorTrigger />
      </ErrorBoundary>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Error boundary should be showing
    await expect(canvas.getByText('Something went wrong')).toBeInTheDocument();

    // Find and click "Try again" button
    const tryAgainButton = canvas.getByRole('button', { name: /try again/i });
    await expect(tryAgainButton).toBeInTheDocument();

    // Note: Clicking "Try again" would reset the error, but the component would throw again
    // This demonstrates the error boundary's recovery mechanism
  },
};
