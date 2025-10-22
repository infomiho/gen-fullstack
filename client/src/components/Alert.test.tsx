import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Alert } from './Alert';

describe('Alert', () => {
  describe('Variant styling', () => {
    it('renders error variant with red styling', () => {
      render(<Alert variant="error">Error message</Alert>);
      const alert = screen.getByText('Error message');
      expect(alert).toBeInTheDocument();
      expect(alert.parentElement).toHaveClass('bg-red-50', 'border-red-200');
      expect(alert).toHaveClass('text-red-700');
    });

    it('renders warning variant with amber styling', () => {
      render(<Alert variant="warning">Warning message</Alert>);
      const alert = screen.getByText('Warning message');
      expect(alert).toBeInTheDocument();
      expect(alert.parentElement).toHaveClass('bg-amber-50', 'border-amber-200');
      expect(alert).toHaveClass('text-amber-700');
    });

    it('renders info variant with blue styling', () => {
      render(<Alert variant="info">Info message</Alert>);
      const alert = screen.getByText('Info message');
      expect(alert).toBeInTheDocument();
      expect(alert.parentElement).toHaveClass('bg-blue-50', 'border-blue-200');
      expect(alert).toHaveClass('text-blue-700');
    });

    it('renders success variant with green styling', () => {
      render(<Alert variant="success">Success message</Alert>);
      const alert = screen.getByText('Success message');
      expect(alert).toBeInTheDocument();
      expect(alert.parentElement).toHaveClass('bg-green-50', 'border-green-200');
      expect(alert).toHaveClass('text-green-700');
    });
  });

  describe('Content rendering', () => {
    it('renders text content', () => {
      render(<Alert variant="info">Simple text message</Alert>);
      expect(screen.getByText('Simple text message')).toBeInTheDocument();
    });

    it('renders JSX content', () => {
      render(
        <Alert variant="error">
          <span>Error: </span>
          <strong>Something went wrong</strong>
        </Alert>,
      );
      expect(screen.getByText('Error:', { exact: false })).toBeInTheDocument();
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('renders multi-line content', () => {
      render(
        <Alert variant="warning">
          This is line one.
          {'\n'}
          This is line two.
        </Alert>,
      );
      const alert = screen.getByText(/This is line one/);
      expect(alert).toBeInTheDocument();
    });
  });

  describe('Custom className', () => {
    it('applies custom className alongside default classes', () => {
      render(
        <Alert variant="info" className="custom-class">
          Message
        </Alert>,
      );
      const container = screen.getByText('Message').parentElement;
      expect(container).toHaveClass('custom-class');
      expect(container).toHaveClass('bg-blue-50'); // Default class still applied
    });
  });

  describe('Common alert patterns', () => {
    it('renders disconnection warning (SessionSidebar pattern)', () => {
      render(
        <Alert variant="warning">
          This session is currently generating. You are disconnected - reconnect to see live
          updates, or refresh the page to see the latest persisted data.
        </Alert>,
      );
      expect(screen.getByText(/This session is currently generating/)).toBeInTheDocument();
    });

    it('renders error message (AppControls pattern)', () => {
      const errorMsg = 'Failed to start application: Docker not available';
      render(<Alert variant="error">{errorMsg}</Alert>);
      expect(screen.getByText(errorMsg)).toBeInTheDocument();
    });
  });
});
