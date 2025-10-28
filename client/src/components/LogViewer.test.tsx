import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import type { AppLog } from '@gen-fullstack/shared';
import { LogViewer } from './LogViewer';

describe('LogViewer', () => {
  const mockLogs: AppLog[] = [
    {
      sessionId: 'test',
      timestamp: Date.now(),
      type: 'stdout',
      level: 'info',
      message: 'App started',
    },
    {
      sessionId: 'test',
      timestamp: Date.now() + 1000,
      type: 'stdout',
      level: 'warn',
      message: 'Warning message',
    },
    {
      sessionId: 'test',
      timestamp: Date.now() + 2000,
      type: 'stderr',
      level: 'error',
      message: 'Error occurred',
    },
    {
      sessionId: 'test',
      timestamp: Date.now() + 3000,
      type: 'stdout',
      level: 'system',
      message: 'System message',
    },
    {
      sessionId: 'test',
      timestamp: Date.now() + 4000,
      type: 'stdout',
      level: 'command',
      message: 'npm install',
    },
  ];

  describe('Basic Rendering', () => {
    it('should render empty state when no logs', () => {
      render(<LogViewer logs={[]} />);
      expect(screen.getByText('No logs yet')).toBeInTheDocument();
      expect(
        screen.getByText('Container logs will appear here when the app starts'),
      ).toBeInTheDocument();
    });

    it('should render logs when provided', () => {
      render(<LogViewer logs={mockLogs} />);
      expect(screen.getByText('App started')).toBeInTheDocument();
      expect(screen.getByText('Warning message')).toBeInTheDocument();
      expect(screen.getByText('Error occurred')).toBeInTheDocument();
    });

    it('should display log count', () => {
      render(<LogViewer logs={mockLogs} />);
      expect(
        screen.getByText(`Showing ${mockLogs.length} of ${mockLogs.length} logs`),
      ).toBeInTheDocument();
    });

    it('should display warning when log limit reached', () => {
      const manyLogs = Array.from({ length: 500 }, (_, i) => ({
        sessionId: 'test',
        timestamp: Date.now() + i,
        type: 'stdout' as const,
        level: 'info' as const,
        message: `Log ${i}`,
      }));

      render(<LogViewer logs={manyLogs} />);
      expect(screen.getByText('⚠️ Log limit reached (500)')).toBeInTheDocument();
    });
  });

  describe('Log Filtering', () => {
    it('should show all logs by default', () => {
      render(<LogViewer logs={mockLogs} />);
      expect(screen.getByText('App started')).toBeInTheDocument();
      expect(screen.getByText('Warning message')).toBeInTheDocument();
      expect(screen.getByText('Error occurred')).toBeInTheDocument();
    });

    it('should filter logs by level when filter button clicked', async () => {
      const user = userEvent.setup();
      render(<LogViewer logs={mockLogs} />);

      // Click "Error" filter
      await user.click(screen.getByRole('button', { name: 'Error' }));

      // Only error log should be visible
      expect(screen.queryByText('App started')).not.toBeInTheDocument();
      expect(screen.queryByText('Warning message')).not.toBeInTheDocument();
      expect(screen.getByText('Error occurred')).toBeInTheDocument();
    });

    it('should show empty state when no logs match filter', async () => {
      const user = userEvent.setup();
      const infoLogs: AppLog[] = [
        {
          sessionId: 'test',
          timestamp: Date.now(),
          type: 'stdout',
          level: 'info',
          message: 'Info 1',
        },
        {
          sessionId: 'test',
          timestamp: Date.now() + 1000,
          type: 'stdout',
          level: 'info',
          message: 'Info 2',
        },
      ];

      render(<LogViewer logs={infoLogs} />);

      // Click "Error" filter
      await user.click(screen.getByRole('button', { name: 'Error' }));

      expect(screen.getByText('No logs match the selected filter')).toBeInTheDocument();
      expect(
        screen.queryByText('Container logs will appear here when the app starts'),
      ).not.toBeInTheDocument();
    });

    it('should update log count when filter is applied', async () => {
      const user = userEvent.setup();
      render(<LogViewer logs={mockLogs} />);

      // Initially shows all logs
      expect(
        screen.getByText(`Showing ${mockLogs.length} of ${mockLogs.length} logs`),
      ).toBeInTheDocument();

      // Click "Error" filter
      await user.click(screen.getByRole('button', { name: 'Error' }));

      // Should show filtered count
      expect(screen.getByText(`Showing 1 of ${mockLogs.length} logs`)).toBeInTheDocument();
    });
  });

  describe('Auto-scroll Functionality', () => {
    let scrollIntoViewMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      // Mock scrollTop and scrollHeight on HTMLDivElement
      Object.defineProperty(HTMLDivElement.prototype, 'scrollTop', {
        configurable: true,
        get: function () {
          return this._scrollTop || 0;
        },
        set: function (value) {
          this._scrollTop = value;
        },
      });

      Object.defineProperty(HTMLDivElement.prototype, 'scrollHeight', {
        configurable: true,
        get: function () {
          return this._scrollHeight || 1000;
        },
        set: function (value) {
          this._scrollHeight = value;
        },
      });

      Object.defineProperty(HTMLDivElement.prototype, 'clientHeight', {
        configurable: true,
        get: function () {
          return this._clientHeight || 400;
        },
        set: function (value) {
          this._clientHeight = value;
        },
      });

      scrollIntoViewMock = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoViewMock;
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should have auto-scroll enabled by default', () => {
      render(<LogViewer logs={mockLogs} />);
      const checkbox = screen.getByRole('checkbox', { name: /auto-scroll/i });
      expect(checkbox).toBeChecked();
    });

    it('should allow toggling auto-scroll', async () => {
      const user = userEvent.setup();
      render(<LogViewer logs={mockLogs} />);

      const checkbox = screen.getByRole('checkbox', { name: /auto-scroll/i });
      expect(checkbox).toBeChecked();

      await user.click(checkbox);
      expect(checkbox).not.toBeChecked();

      await user.click(checkbox);
      expect(checkbox).toBeChecked();
    });

    it('should scroll to bottom when new logs arrive and auto-scroll is enabled', async () => {
      const { rerender } = render(<LogViewer logs={mockLogs} />);

      // Get the log container
      const logContainer = screen
        .getByText('App started')
        .closest('[style*="height"]') as HTMLDivElement & {
        _scrollTop?: number;
        _scrollHeight?: number;
      };

      // Mock initial state
      logContainer._scrollTop = 0;
      logContainer._scrollHeight = 1000;

      // Add new logs
      const newLogs = [
        ...mockLogs,
        {
          sessionId: 'test',
          timestamp: Date.now() + 5000,
          type: 'stdout' as const,
          level: 'info' as const,
          message: 'New log entry',
        },
      ];

      rerender(<LogViewer logs={newLogs} />);

      // Wait for effect to run
      await waitFor(() => {
        expect(logContainer.scrollTop).toBe(1000); // Should be set to scrollHeight
      });
    });

    it('should not scroll when auto-scroll is disabled', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<LogViewer logs={mockLogs} />);

      // Disable auto-scroll
      const checkbox = screen.getByRole('checkbox', { name: /auto-scroll/i });
      await user.click(checkbox);

      // Get the log container
      const logContainer = screen
        .getByText('App started')
        .closest('[style*="height"]') as HTMLDivElement & {
        _scrollTop?: number;
      };

      // Set initial scroll position
      logContainer._scrollTop = 100;
      const initialScrollTop = logContainer.scrollTop;

      // Add new logs
      const newLogs = [
        ...mockLogs,
        {
          sessionId: 'test',
          timestamp: Date.now() + 5000,
          type: 'stdout' as const,
          level: 'info' as const,
          message: 'New log entry',
        },
      ];

      rerender(<LogViewer logs={newLogs} />);

      // Wait a bit to ensure effect doesn't run
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Scroll position should not change
      expect(logContainer.scrollTop).toBe(initialScrollTop);
    });
  });

  describe('Log Formatting', () => {
    it('should display timestamp in HH:MM:SS format', () => {
      const testDate = new Date('2024-01-15T14:30:45.000Z');
      const logs: AppLog[] = [
        {
          sessionId: 'test',
          timestamp: testDate.getTime(),
          type: 'stdout',
          level: 'info',
          message: 'Test message',
        },
      ];

      render(<LogViewer logs={logs} />);

      // Format expected time based on locale
      const expectedTime = testDate.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      expect(screen.getByText(expectedTime)).toBeInTheDocument();
    });

    it('should display log level labels correctly', () => {
      render(<LogViewer logs={mockLogs} />);

      expect(screen.getByText('INFO')).toBeInTheDocument();
      expect(screen.getByText('WARN')).toBeInTheDocument();
      expect(screen.getByText('ERROR')).toBeInTheDocument();
      expect(screen.getByText('SYS')).toBeInTheDocument(); // system -> SYS
      expect(screen.getByText('CMD')).toBeInTheDocument(); // command -> CMD
    });

    it('should display log messages', () => {
      render(<LogViewer logs={mockLogs} />);

      mockLogs.forEach((log) => {
        expect(screen.getByText(log.message)).toBeInTheDocument();
      });
    });
  });

  describe('Filter Button States', () => {
    it('should highlight active filter button', async () => {
      const user = userEvent.setup();
      render(<LogViewer logs={mockLogs} />);

      const errorButton = screen.getByRole('button', { name: 'Error' });
      await user.click(errorButton);

      // FilterButton component should apply active styles (red background when active)
      expect(errorButton).toHaveClass('bg-red-600', 'text-white');
    });

    it('should have "All" filter active by default', () => {
      render(<LogViewer logs={mockLogs} />);
      const allButton = screen.getByRole('button', { name: 'All' });
      // Gray variant: active state is bg-primary
      expect(allButton).toHaveClass('bg-primary', 'text-primary-foreground');
    });
  });

  describe('Edge Cases', () => {
    it('should handle logs with same timestamp', () => {
      const sameTimestamp = Date.now();
      const logs: AppLog[] = [
        {
          sessionId: 'test',
          timestamp: sameTimestamp,
          type: 'stdout',
          level: 'info',
          message: 'Log 1',
        },
        {
          sessionId: 'test',
          timestamp: sameTimestamp,
          type: 'stdout',
          level: 'info',
          message: 'Log 2',
        },
        {
          sessionId: 'test',
          timestamp: sameTimestamp,
          type: 'stdout',
          level: 'info',
          message: 'Log 3',
        },
      ];

      render(<LogViewer logs={logs} />);

      expect(screen.getByText('Log 1')).toBeInTheDocument();
      expect(screen.getByText('Log 2')).toBeInTheDocument();
      expect(screen.getByText('Log 3')).toBeInTheDocument();
    });

    it('should handle very long log messages', () => {
      const longMessage = 'A'.repeat(500);
      const logs: AppLog[] = [
        {
          sessionId: 'test',
          timestamp: Date.now(),
          type: 'stdout',
          level: 'info',
          message: longMessage,
        },
      ];

      render(<LogViewer logs={logs} />);
      expect(screen.getByText(longMessage)).toBeInTheDocument();
    });

    it('should handle special characters in log messages', () => {
      const logs: AppLog[] = [
        {
          sessionId: 'test',
          timestamp: Date.now(),
          type: 'stdout',
          level: 'info',
          message: '<script>alert("xss")</script>',
        },
        {
          sessionId: 'test',
          timestamp: Date.now() + 1,
          type: 'stdout',
          level: 'info',
          message: 'Line 1\nLine 2\nLine 3',
        },
        {
          sessionId: 'test',
          timestamp: Date.now() + 2,
          type: 'stdout',
          level: 'info',
          message: 'Emoji test 🚀 ✅ ⚠️',
        },
      ];

      render(<LogViewer logs={logs} />);

      // Text should be rendered as-is (React escapes by default)
      expect(screen.getByText('<script>alert("xss")</script>')).toBeInTheDocument();
      // Multiline text is rendered with actual newlines in the DOM
      expect(
        screen.getByText((_, element) => {
          return element?.textContent === 'Line 1\nLine 2\nLine 3';
        }),
      ).toBeInTheDocument();
      expect(screen.getByText('Emoji test 🚀 ✅ ⚠️')).toBeInTheDocument();
    });
  });

  describe('Command Progress Indicators', () => {
    it('should show progress indicator for command logs', async () => {
      const now = Date.now();
      const commandLogs: AppLog[] = [
        {
          sessionId: 'test',
          timestamp: now - 2500, // Started 2.5 seconds ago
          type: 'stdout',
          level: 'command',
          message: '$ npm install --loglevel=warn',
        },
      ];

      render(<LogViewer logs={commandLogs} />);

      // Should show command message
      expect(screen.getByText('$ npm install --loglevel=warn')).toBeInTheDocument();

      // Should show elapsed time (will be ~2.5s since it started 2.5s ago)
      await waitFor(() => {
        expect(screen.getByText(/\d+\.\ds/)).toBeInTheDocument();
      });
    });

    it('should show correct duration for instant commands', async () => {
      const now = Date.now();

      // Command and completion happen very close together (100ms apart)
      const instantLogs: AppLog[] = [
        {
          sessionId: 'test',
          timestamp: now - 1000,
          type: 'stdout',
          level: 'command',
          message: '$ npx prisma generate',
        },
        {
          sessionId: 'test',
          timestamp: now - 900, // Completed 100ms after start
          type: 'stdout',
          level: 'system',
          message: 'Generated Prisma client',
        },
      ];

      render(<LogViewer logs={instantLogs} />);

      // Should show 0.1s (frozen at completion time), not a large duration
      await waitFor(() => {
        const text = screen.getByText('0.1s');
        expect(text).toBeInTheDocument();
      });
    });

    it('should track multiple commands independently', async () => {
      const now = Date.now();

      const multipleLogs: AppLog[] = [
        {
          sessionId: 'test',
          timestamp: now - 5000,
          type: 'stdout',
          level: 'command',
          message: '$ npm install',
        },
        {
          sessionId: 'test',
          timestamp: now - 3000,
          type: 'stdout',
          level: 'system',
          message: 'Install complete',
        },
        {
          sessionId: 'test',
          timestamp: now - 2500,
          type: 'stdout',
          level: 'command',
          message: '$ npx prisma generate',
        },
      ];

      render(<LogViewer logs={multipleLogs} />);

      // First command should show 2.0s (completed)
      await waitFor(() => {
        expect(screen.getByText('2.0s')).toBeInTheDocument();
      });

      // Second command should show elapsed time
      await waitFor(() => {
        const durations = screen.getAllByText(/\d+\.\ds/);
        expect(durations.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('should format longer durations correctly', async () => {
      const now = Date.now();

      const commandLogs: AppLog[] = [
        {
          sessionId: 'test',
          timestamp: now - 65000, // 65 seconds ago
          type: 'stdout',
          level: 'command',
          message: '$ npm install',
        },
        {
          sessionId: 'test',
          timestamp: now - 1, // Just completed
          type: 'stdout',
          level: 'system',
          message: 'Done',
        },
      ];

      render(<LogViewer logs={commandLogs} />);

      // 65 seconds ≈ "1m 4s" or "1m 5s" (depending on exact timing)
      await waitFor(() => {
        const text = screen.getByText(/1m \ds/);
        expect(text).toBeInTheDocument();
        // Should be in the range of 1m 4s to 1m 5s
        expect(text.textContent).toMatch(/1m [4-5]s/);
      });
    });

    it('should show spinner icon for running commands', async () => {
      const now = Date.now();
      const commandLogs: AppLog[] = [
        {
          sessionId: 'test',
          timestamp: now - 1000,
          type: 'stdout',
          level: 'command',
          message: '$ npm install',
        },
      ];

      const { container } = render(<LogViewer logs={commandLogs} />);

      // Should have a spinning loader icon (Loader2 from lucide-react)
      await waitFor(() => {
        const spinner = container.querySelector('.animate-spin');
        expect(spinner).toBeInTheDocument();
      });
    });

    it('should show checkmark icon for completed commands', async () => {
      const now = Date.now();

      const commandLogs: AppLog[] = [
        {
          sessionId: 'test',
          timestamp: now - 2000,
          type: 'stdout',
          level: 'command',
          message: '$ npm install',
        },
        {
          sessionId: 'test',
          timestamp: now - 1000,
          type: 'stdout',
          level: 'system',
          message: 'Install complete',
        },
      ];

      const { container } = render(<LogViewer logs={commandLogs} />);

      await waitFor(() => {
        // Should NOT have a spinning loader (command is complete)
        const spinner = container.querySelector('.animate-spin');
        expect(spinner).not.toBeInTheDocument();
      });

      // Should show frozen time of 1.0s
      await waitFor(() => {
        expect(screen.getByText('1.0s')).toBeInTheDocument();
      });
    });

    it('should clear command state when logs are reset', async () => {
      const now = Date.now();
      const oldLogs: AppLog[] = [
        {
          sessionId: 'test',
          timestamp: now - 300000, // 5 minutes ago (old container)
          type: 'stdout',
          level: 'command',
          message: '$ npm install',
        },
      ];

      const { rerender } = render(<LogViewer logs={oldLogs} />);

      // Should show command from old logs
      await waitFor(() => {
        expect(screen.getByText('$ npm install')).toBeInTheDocument();
      });

      // Simulate container restart with new logs
      const newLogs: AppLog[] = [
        {
          sessionId: 'test',
          timestamp: now,
          type: 'stdout',
          level: 'command',
          message: '$ npx prisma generate',
        },
      ];

      rerender(<LogViewer logs={newLogs} />);

      // Old command should be gone, new command should be visible
      await waitFor(() => {
        expect(screen.queryByText('$ npm install')).not.toBeInTheDocument();
        expect(screen.getByText('$ npx prisma generate')).toBeInTheDocument();
      });
    });
  });
});
