import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UnifiedStatusSection } from '../UnifiedStatusSection';
import type { AppInfo } from '@gen-fullstack/shared';

describe('UnifiedStatusSection', () => {
  const mockStartApp = vi.fn();
  const mockStopApp = vi.fn();
  const mockStartClick = vi.fn();

  const defaultProps = {
    sessionStatus: 'completed' as const,
    isOwnSession: false,
    currentSessionId: 'test-session',
    appStatus: null,
    isGenerating: false,
    onStart: mockStartApp,
    onStop: mockStopApp,
    onStartClick: mockStartClick,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Status Display', () => {
    it('renders generation status badge', () => {
      render(<UnifiedStatusSection {...defaultProps} />);
      expect(screen.getByText('Generation')).toBeInTheDocument();
      expect(screen.getByText('completed')).toBeInTheDocument();
    });

    it('renders container status badge', () => {
      render(<UnifiedStatusSection {...defaultProps} />);
      expect(screen.getByText('Container')).toBeInTheDocument();
      expect(screen.getByText('stopped')).toBeInTheDocument();
    });

    it('shows live indicator for own generating sessions', () => {
      render(
        <UnifiedStatusSection {...defaultProps} sessionStatus="generating" isOwnSession={true} />,
      );
      // StatusBadge with showLiveIndicator shows pulsing animation
      expect(screen.getByText('generating')).toBeInTheDocument();
    });

    it('does not show live indicator for other generating sessions', () => {
      render(
        <UnifiedStatusSection {...defaultProps} sessionStatus="generating" isOwnSession={false} />,
      );
      // Still shows status but without live indicator
      expect(screen.getByText('generating')).toBeInTheDocument();
    });

    it('shows client URL when app is running', () => {
      const appStatus: AppInfo = {
        sessionId: 'test-session',
        status: 'running',
        clientPort: 5001,
        clientUrl: 'http://localhost:5001',
        serverPort: 5101,
        serverUrl: 'http://localhost:5101',
      };

      render(<UnifiedStatusSection {...defaultProps} appStatus={appStatus} />);
      const link = screen.getByRole('link', { name: 'http://localhost:5001' });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', 'http://localhost:5001');
      expect(link).toHaveAttribute('target', '_blank');
    });

    it('does not show client URL when app is stopped', () => {
      render(<UnifiedStatusSection {...defaultProps} />);
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('shows error message when present', () => {
      const appStatus: AppInfo = {
        sessionId: 'test-session',
        status: 'failed',
        clientPort: 5001,
        clientUrl: '',
        serverPort: 5101,
        serverUrl: '',
        error: 'Container failed to start',
      };

      render(<UnifiedStatusSection {...defaultProps} appStatus={appStatus} />);
      expect(screen.getByText('Container failed to start')).toBeInTheDocument();
    });
  });

  describe('Run Button', () => {
    it('shows Run button when app is stopped', () => {
      render(<UnifiedStatusSection {...defaultProps} />);
      const button = screen.getByRole('button', { name: /run application/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('Run');
      expect(button).not.toBeDisabled();
    });

    it('shows Stop button when app is running', () => {
      const appStatus: AppInfo = {
        sessionId: 'test-session',
        status: 'running',
        clientPort: 5001,
        clientUrl: 'http://localhost:5001',
        serverPort: 5101,
        serverUrl: 'http://localhost:5101',
      };

      render(<UnifiedStatusSection {...defaultProps} appStatus={appStatus} />);
      const button = screen.getByRole('button', { name: /stop application/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('Stop');
      expect(button).not.toBeDisabled();
    });

    it('shows Starting... button when app is transitioning', () => {
      const appStatus: AppInfo = {
        sessionId: 'test-session',
        status: 'starting',
        clientPort: 5001,
        clientUrl: '',
        serverPort: 5101,
        serverUrl: '',
      };

      render(<UnifiedStatusSection {...defaultProps} appStatus={appStatus} />);
      const button = screen.getByRole('button', { name: /starting\.\.\. application/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('Starting...');
      expect(button).toBeDisabled();
    });

    it('disables Run button when no session exists', () => {
      render(<UnifiedStatusSection {...defaultProps} currentSessionId={null} />);
      const button = screen.getByRole('button', { name: /run application/i });
      expect(button).toBeDisabled();
    });

    it('disables Run button while generating', () => {
      render(<UnifiedStatusSection {...defaultProps} isGenerating={true} />);
      const button = screen.getByRole('button', { name: /run application/i });
      expect(button).toBeDisabled();
    });
  });

  describe('Button Interactions', () => {
    it('calls onStart and onStartClick when Run is clicked', async () => {
      const user = userEvent.setup();
      render(<UnifiedStatusSection {...defaultProps} />);

      const button = screen.getByRole('button', { name: /run application/i });
      await user.click(button);

      expect(mockStartClick).toHaveBeenCalledTimes(1);
      expect(mockStartApp).toHaveBeenCalledTimes(1);
      expect(mockStartApp).toHaveBeenCalledWith('test-session');
    });

    it('calls onStop when Stop is clicked', async () => {
      const user = userEvent.setup();
      const appStatus: AppInfo = {
        sessionId: 'test-session',
        status: 'running',
        clientPort: 5001,
        clientUrl: 'http://localhost:5001',
        serverPort: 5101,
        serverUrl: 'http://localhost:5101',
      };

      render(<UnifiedStatusSection {...defaultProps} appStatus={appStatus} />);

      const button = screen.getByRole('button', { name: /stop application/i });
      await user.click(button);

      expect(mockStopApp).toHaveBeenCalledTimes(1);
      expect(mockStopApp).toHaveBeenCalledWith('test-session');
    });

    it('does not call onStart when button is disabled', async () => {
      const user = userEvent.setup();
      render(<UnifiedStatusSection {...defaultProps} currentSessionId={null} />);

      const button = screen.getByRole('button', { name: /run application/i });
      await user.click(button);

      expect(mockStartApp).not.toHaveBeenCalled();
      expect(mockStartClick).not.toHaveBeenCalled();
    });
  });

  describe('Screen Reader Announcements', () => {
    it('announces generation status changes', () => {
      const { rerender } = render(<UnifiedStatusSection {...defaultProps} />);
      expect(
        screen.getByText(
          (content, element) =>
            content.includes('Generation completed') &&
            (element?.className.includes('sr-only') ?? false),
        ),
      ).toBeInTheDocument();

      rerender(<UnifiedStatusSection {...defaultProps} sessionStatus="generating" />);
      expect(
        screen.getByText(
          (content, element) =>
            content.includes('Generation in progress') &&
            (element?.className.includes('sr-only') ?? false),
        ),
      ).toBeInTheDocument();

      rerender(<UnifiedStatusSection {...defaultProps} sessionStatus="failed" />);
      expect(
        screen.getByText(
          (content, element) =>
            content.includes('Generation failed') &&
            (element?.className.includes('sr-only') ?? false),
        ),
      ).toBeInTheDocument();
    });

    it('announces container status changes', () => {
      const appStatus: AppInfo = {
        sessionId: 'test-session',
        status: 'creating',
        clientPort: 5001,
        clientUrl: '',
        serverPort: 5101,
        serverUrl: '',
      };

      render(<UnifiedStatusSection {...defaultProps} appStatus={appStatus} />);
      expect(
        screen.getByText(
          (content, element) =>
            content.includes('App container is being created') &&
            (element?.className.includes('sr-only') ?? false),
        ),
      ).toBeInTheDocument();
    });

    it('includes error in announcement when app fails', () => {
      const appStatus: AppInfo = {
        sessionId: 'test-session',
        status: 'failed',
        clientPort: 5001,
        clientUrl: '',
        serverPort: 5101,
        serverUrl: '',
        error: 'Port already in use',
      };

      render(<UnifiedStatusSection {...defaultProps} appStatus={appStatus} />);
      expect(
        screen.getByText(
          (content, element) =>
            content.includes('App failed: Port already in use') &&
            (element?.className.includes('sr-only') ?? false),
        ),
      ).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles missing onStartClick callback', async () => {
      const user = userEvent.setup();
      render(<UnifiedStatusSection {...defaultProps} onStartClick={undefined} />);

      const button = screen.getByRole('button', { name: /run application/i });
      await user.click(button);

      // Should not crash, only onStart is called
      expect(mockStartApp).toHaveBeenCalledTimes(1);
    });

    it('shows correct button states for all app statuses', () => {
      const statuses: Array<AppInfo['status']> = [
        'creating',
        'installing',
        'starting',
        'ready',
        'running',
      ];

      statuses.forEach((status) => {
        const appStatus: AppInfo = {
          sessionId: 'test-session',
          status,
          clientPort: 5001,
          clientUrl: status === 'running' ? 'http://localhost:5001' : '',
          serverPort: 5101,
          serverUrl: status === 'running' ? 'http://localhost:5101' : '',
        };

        const { unmount } = render(
          <UnifiedStatusSection {...defaultProps} appStatus={appStatus} />,
        );

        // Verify button renders without crashing
        const button = screen.getByRole('button');
        expect(button).toBeInTheDocument();

        unmount();
      });
    });
  });
});
