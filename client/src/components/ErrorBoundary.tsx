import type React from 'react';
import { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

/**
 * ErrorBoundary Component
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs the errors, and displays a fallback UI instead of crashing the app.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(_error: Error, _errorInfo: React.ErrorInfo) {}

  render() {
    if (this.state.hasError) {
      // Render custom fallback UI if provided, otherwise default error message
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">⚠️</span>
            <h3 className="font-semibold text-red-900">Something went wrong</h3>
          </div>
          <p className="text-sm text-red-700 mb-2">
            An error occurred while rendering this component.
          </p>
          {this.state.error && (
            <pre className="text-xs bg-red-100 p-2 rounded overflow-x-auto text-red-800">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            className="mt-3 px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
