import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { BrowserRouter } from 'react-router';
import { ErrorBoundary } from './SessionPage';

// Mock react-router hooks
const mockUseRouteError = vi.fn();
const mockIsRouteErrorResponse = vi.fn();

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useRouteError: () => mockUseRouteError(),
    isRouteErrorResponse: (error: unknown) => mockIsRouteErrorResponse(error),
    Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  };
});

describe('SessionPage ErrorBoundary', () => {
  beforeEach(() => {
    mockUseRouteError.mockReset();
    mockIsRouteErrorResponse.mockReset();
  });

  describe('Response Errors (404, 500, etc.)', () => {
    it('should display 404 error with custom message', () => {
      const error = {
        status: 404,
        statusText: 'Not Found',
        data: 'Session not found',
      };
      mockUseRouteError.mockReturnValue(error);
      mockIsRouteErrorResponse.mockReturnValue(true);

      render(
        <BrowserRouter>
          <ErrorBoundary />
        </BrowserRouter>,
      );

      expect(screen.getByText('404 Not Found')).toBeInTheDocument();
      expect(screen.getByText('Session not found')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Go Home' })).toHaveAttribute('href', '/');
    });

    it('should display 500 error', () => {
      const error = {
        status: 500,
        statusText: 'Internal Server Error',
        data: 'Something went wrong on the server',
      };
      mockUseRouteError.mockReturnValue(error);
      mockIsRouteErrorResponse.mockReturnValue(true);

      render(
        <BrowserRouter>
          <ErrorBoundary />
        </BrowserRouter>,
      );

      expect(screen.getByText('500 Internal Server Error')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong on the server')).toBeInTheDocument();
    });

    it('should display default message when data is not provided', () => {
      const error = {
        status: 403,
        statusText: 'Forbidden',
        data: null,
      };
      mockUseRouteError.mockReturnValue(error);
      mockIsRouteErrorResponse.mockReturnValue(true);

      render(
        <BrowserRouter>
          <ErrorBoundary />
        </BrowserRouter>,
      );

      expect(screen.getByText('403 Forbidden')).toBeInTheDocument();
      expect(screen.getByText('An error occurred')).toBeInTheDocument();
    });
  });

  describe('JavaScript Errors (Network, etc.)', () => {
    it('should display network error message', () => {
      const error = new Error('Failed to fetch session data');
      mockUseRouteError.mockReturnValue(error);
      mockIsRouteErrorResponse.mockReturnValue(false);

      render(
        <BrowserRouter>
          <ErrorBoundary />
        </BrowserRouter>,
      );

      expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
      expect(screen.getByText('Failed to fetch session data')).toBeInTheDocument();
      // Network errors show specific secondary message with "try again later"
      expect(
        screen.getByText(
          'Unable to connect to the server. Please check your internet connection or try again later.',
        ),
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Go Home' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });

    it('should display generic error message for non-network errors', () => {
      const error = new Error('Something unexpected happened');
      mockUseRouteError.mockReturnValue(error);
      mockIsRouteErrorResponse.mockReturnValue(false);

      render(
        <BrowserRouter>
          <ErrorBoundary />
        </BrowserRouter>,
      );

      expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
      expect(screen.getByText('Something unexpected happened')).toBeInTheDocument();
      expect(
        screen.getByText('An unexpected error occurred. Please try again.'),
      ).toBeInTheDocument();
    });

    it('should reload page when Retry button is clicked', async () => {
      const user = userEvent.setup();
      const error = new Error('Test error');
      mockUseRouteError.mockReturnValue(error);
      mockIsRouteErrorResponse.mockReturnValue(false);

      // Mock window.location.reload
      const reloadMock = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { reload: reloadMock },
        writable: true,
      });

      render(
        <BrowserRouter>
          <ErrorBoundary />
        </BrowserRouter>,
      );

      const retryButton = screen.getByRole('button', { name: 'Retry' });
      await user.click(retryButton);

      expect(reloadMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Unknown Errors', () => {
    it('should display unknown error message', () => {
      const error = 'some string error';
      mockUseRouteError.mockReturnValue(error);
      mockIsRouteErrorResponse.mockReturnValue(false);

      render(
        <BrowserRouter>
          <ErrorBoundary />
        </BrowserRouter>,
      );

      expect(screen.getByText('Unknown Error')).toBeInTheDocument();
      expect(screen.getByText('An unexpected error occurred')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Go Home' })).toBeInTheDocument();
    });

    it('should handle null error', () => {
      const error = null;
      mockUseRouteError.mockReturnValue(error);
      mockIsRouteErrorResponse.mockReturnValue(false);

      render(
        <BrowserRouter>
          <ErrorBoundary />
        </BrowserRouter>,
      );

      expect(screen.getByText('Unknown Error')).toBeInTheDocument();
    });
  });

  describe('Error Detection Logic', () => {
    it('should correctly detect network errors with "fetch" in message', () => {
      const error = new Error('Failed to fetch resource');
      mockUseRouteError.mockReturnValue(error);
      mockIsRouteErrorResponse.mockReturnValue(false);

      render(
        <BrowserRouter>
          <ErrorBoundary />
        </BrowserRouter>,
      );

      expect(screen.getByText('Failed to fetch resource')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Unable to connect to the server. Please check your internet connection or try again later.',
        ),
      ).toBeInTheDocument();
    });

    it('should correctly detect network errors with "Network" in message', () => {
      const error = new Error('Network request failed');
      mockUseRouteError.mockReturnValue(error);
      mockIsRouteErrorResponse.mockReturnValue(false);

      render(
        <BrowserRouter>
          <ErrorBoundary />
        </BrowserRouter>,
      );

      expect(screen.getByText('Network request failed')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Unable to connect to the server. Please check your internet connection or try again later.',
        ),
      ).toBeInTheDocument();
    });
  });
});
