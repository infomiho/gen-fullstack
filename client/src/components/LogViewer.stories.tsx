import type { AppLog } from '@gen-fullstack/shared';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from '@storybook/test';
import { LogViewer } from './LogViewer';

/**
 * LogViewer displays container logs with filtering by level and auto-scroll functionality.
 * Shows logs in a terminal-style interface with timestamps and level indicators.
 */
const meta: Meta<typeof LogViewer> = {
  title: 'Components/LogViewer',
  component: LogViewer,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof LogViewer>;

const sampleLogs: AppLog[] = [
  {
    sessionId: 'test-session-123',
    type: 'stdout',
    level: 'info',
    message: 'Starting development server...',
    timestamp: Date.now() - 10000,
  },
  {
    sessionId: 'test-session-123',
    type: 'stdout',
    level: 'info',
    message: 'Installing dependencies with npm install',
    timestamp: Date.now() - 9000,
  },
  {
    sessionId: 'test-session-123',
    type: 'stdout',
    level: 'info',
    message: 'added 234 packages in 3s',
    timestamp: Date.now() - 6000,
  },
  {
    sessionId: 'test-session-123',
    type: 'stdout',
    level: 'info',
    message: 'Running npm run dev',
    timestamp: Date.now() - 5000,
  },
  {
    sessionId: 'test-session-123',
    type: 'stdout',
    level: 'info',
    message: 'VITE v5.0.0  ready in 432 ms',
    timestamp: Date.now() - 4000,
  },
  {
    sessionId: 'test-session-123',
    type: 'stdout',
    level: 'info',
    message: '  ➜  Local:   http://localhost:5173/',
    timestamp: Date.now() - 3900,
  },
  {
    sessionId: 'test-session-123',
    type: 'stdout',
    level: 'info',
    message: '  ➜  Network: use --host to expose',
    timestamp: Date.now() - 3800,
  },
  {
    sessionId: 'test-session-123',
    type: 'stdout',
    level: 'warn',
    message: 'Slow transform detected: /src/utils.ts took 123ms',
    timestamp: Date.now() - 2000,
  },
  {
    sessionId: 'test-session-123',
    type: 'stderr',
    level: 'error',
    message: 'Failed to resolve import "./missing-file.js"',
    timestamp: Date.now() - 1000,
  },
  {
    sessionId: 'test-session-123',
    type: 'stdout',
    level: 'info',
    message: 'Hot module reload triggered',
    timestamp: Date.now() - 500,
  },
];

/**
 * Empty state - no logs yet
 */
export const Empty: Story = {
  args: {
    logs: [],
  },
};

/**
 * Normal operation with mixed log levels
 */
export const WithLogs: Story = {
  args: {
    logs: sampleLogs,
  },
};

/**
 * Only info logs
 */
export const InfoOnly: Story = {
  args: {
    logs: sampleLogs.filter((log) => log.level === 'info'),
  },
};

/**
 * Only errors
 */
export const ErrorsOnly: Story = {
  args: {
    logs: sampleLogs.filter((log) => log.level === 'error'),
  },
};

/**
 * Many logs - demonstrates scrolling
 */
export const ManyLogs: Story = {
  args: {
    logs: Array.from({ length: 100 }, (_, i) => ({
      sessionId: 'test-session-123',
      type: (i % 3 === 2 ? 'stderr' : 'stdout') as AppLog['type'],
      level: ['info', 'warn', 'error'][i % 3] as AppLog['level'],
      message: `Log message ${i + 1}: Processing file src/components/Component${i}.tsx`,
      timestamp: Date.now() - (100 - i) * 100,
    })),
  },
};

/**
 * Limit reached - 500 logs
 */
export const LimitReached: Story = {
  args: {
    logs: Array.from({ length: 500 }, (_, i) => ({
      sessionId: 'test-session-123',
      type: 'stdout',
      level: 'info' as AppLog['level'],
      message: `Log ${i + 1}`,
      timestamp: Date.now() - (500 - i) * 10,
    })),
  },
};

/**
 * Build output logs
 */
export const BuildOutput: Story = {
  args: {
    logs: [
      {
        sessionId: 'test-session-123',
        type: 'stdout',
        level: 'info',
        message: '> vite build',
        timestamp: Date.now() - 5000,
      },
      {
        sessionId: 'test-session-123',
        type: 'stdout',
        level: 'info',
        message: 'vite v5.0.0 building for production...',
        timestamp: Date.now() - 4000,
      },
      {
        sessionId: 'test-session-123',
        type: 'stdout',
        level: 'info',
        message: 'transforming...',
        timestamp: Date.now() - 3000,
      },
      {
        sessionId: 'test-session-123',
        type: 'stdout',
        level: 'info',
        message: '✓ 45 modules transformed.',
        timestamp: Date.now() - 2000,
      },
      {
        sessionId: 'test-session-123',
        type: 'stdout',
        level: 'info',
        message: 'rendering chunks...',
        timestamp: Date.now() - 1000,
      },
      {
        sessionId: 'test-session-123',
        type: 'stdout',
        level: 'info',
        message: 'dist/index.html                  0.45 kB │ gzip:  0.30 kB',
        timestamp: Date.now() - 500,
      },
      {
        sessionId: 'test-session-123',
        type: 'stdout',
        level: 'info',
        message: 'dist/assets/index-abc123.css    2.35 kB │ gzip:  1.02 kB',
        timestamp: Date.now() - 400,
      },
      {
        sessionId: 'test-session-123',
        type: 'stdout',
        level: 'info',
        message: 'dist/assets/index-xyz789.js    47.82 kB │ gzip: 17.31 kB',
        timestamp: Date.now() - 300,
      },
      {
        sessionId: 'test-session-123',
        type: 'stdout',
        level: 'info',
        message: '✓ built in 2.34s',
        timestamp: Date.now() - 200,
      },
    ],
  },
};

/**
 * Test: User can filter logs by level
 */
export const UserCanFilterLogs: Story = {
  args: {
    logs: sampleLogs,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Initially showing all logs
    await expect(canvas.getByText(/Showing 10 of 10 logs/i)).toBeInTheDocument();

    // Click "Error" filter button
    const errorButton = canvas.getByRole('button', { name: /^Error$/i });
    await userEvent.click(errorButton);

    // Should now show only error logs
    await expect(canvas.getByText(/Showing 1 of 10 logs/i)).toBeInTheDocument();
    await expect(canvas.getByText(/Failed to resolve import/i)).toBeInTheDocument();

    // Click "All" to show all logs again
    const allButton = canvas.getByRole('button', { name: /^All$/i });
    await userEvent.click(allButton);

    // Should show all logs again
    await expect(canvas.getByText(/Showing 10 of 10 logs/i)).toBeInTheDocument();
  },
};

/**
 * Test: User can toggle auto-scroll
 */
export const UserCanToggleAutoScroll: Story = {
  args: {
    logs: sampleLogs,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Find auto-scroll checkbox
    const autoScrollCheckbox = canvas.getByRole('checkbox', { name: /auto-scroll/i });

    // Should be checked by default
    await expect(autoScrollCheckbox).toBeChecked();

    // Click to uncheck
    await userEvent.click(autoScrollCheckbox);
    await expect(autoScrollCheckbox).not.toBeChecked();

    // Click to check again
    await userEvent.click(autoScrollCheckbox);
    await expect(autoScrollCheckbox).toBeChecked();
  },
};
