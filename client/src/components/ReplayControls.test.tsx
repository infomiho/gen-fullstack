import { render, screen } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { userEvent } from '@testing-library/user-event';
import { ReplayControls } from './ReplayControls';
import { useReplayStore } from '../stores/replay.store';

describe('ReplayControls', () => {
  beforeEach(() => {
    // Reset store state before each test
    const store = useReplayStore.getState();
    store.exitReplayMode();
  });

  describe('Rendering', () => {
    it('should render play button when not playing', () => {
      useReplayStore.getState().enterReplayMode('session-123', {
        sessionStartTime: 1000,
        duration: 120000,
        timelineItems: [],
        files: [],
      });

      render(<ReplayControls />);

      expect(screen.getByRole('button', { name: 'Play playback' })).toBeInTheDocument();
    });

    it('should render pause button when playing', () => {
      useReplayStore.getState().enterReplayMode('session-123', {
        sessionStartTime: 1000,
        duration: 120000,
        timelineItems: [],
        files: [],
      });
      useReplayStore.getState().play();

      render(<ReplayControls />);

      expect(screen.getByRole('button', { name: 'Pause playback' })).toBeInTheDocument();
    });

    it('should render time display', () => {
      useReplayStore.getState().enterReplayMode('session-123', {
        sessionStartTime: 1000,
        duration: 120000, // 2 minutes
        timelineItems: [],
        files: [],
      });

      render(<ReplayControls />);

      expect(screen.getByText('00:00 / 02:00')).toBeInTheDocument();
    });

    it('should render current time at halfway point', () => {
      useReplayStore.getState().enterReplayMode('session-123', {
        sessionStartTime: 1000,
        duration: 120000, // 2 minutes
        timelineItems: [],
        files: [],
      });
      useReplayStore.getState().setCurrentTime(60000); // 1 minute

      render(<ReplayControls />);

      expect(screen.getByText('01:00 / 02:00')).toBeInTheDocument();
    });
  });

  describe('Play/Pause Interaction', () => {
    it('should call play when play button is clicked', async () => {
      const user = userEvent.setup();

      useReplayStore.getState().enterReplayMode('session-123', {
        sessionStartTime: 1000,
        duration: 120000,
        timelineItems: [],
        files: [],
      });

      render(<ReplayControls />);

      const playButton = screen.getByRole('button', { name: 'Play playback' });
      await user.click(playButton);

      expect(useReplayStore.getState().isPlaying).toBe(true);
    });

    it('should call pause when pause button is clicked', async () => {
      const user = userEvent.setup();

      useReplayStore.getState().enterReplayMode('session-123', {
        sessionStartTime: 1000,
        duration: 120000,
        timelineItems: [],
        files: [],
      });
      useReplayStore.getState().play();

      render(<ReplayControls />);

      const pauseButton = screen.getByRole('button', { name: 'Pause playback' });
      await user.click(pauseButton);

      expect(useReplayStore.getState().isPlaying).toBe(false);
    });

    it('should toggle between play and pause', async () => {
      const user = userEvent.setup();

      useReplayStore.getState().enterReplayMode('session-123', {
        sessionStartTime: 1000,
        duration: 120000,
        timelineItems: [],
        files: [],
      });

      const { rerender } = render(<ReplayControls />);

      // Initially paused
      expect(screen.getByRole('button', { name: 'Play playback' })).toBeInTheDocument();

      // Click to play
      await user.click(screen.getByRole('button'));
      rerender(<ReplayControls />);
      expect(screen.getByRole('button', { name: 'Pause playback' })).toBeInTheDocument();

      // Click to pause
      await user.click(screen.getByRole('button'));
      rerender(<ReplayControls />);
      expect(screen.getByRole('button', { name: 'Play playback' })).toBeInTheDocument();
    });
  });

  describe('Time Display Updates', () => {
    it('should update time display when currentTime changes', () => {
      useReplayStore.getState().enterReplayMode('session-123', {
        sessionStartTime: 1000,
        duration: 300000, // 5 minutes
        timelineItems: [],
        files: [],
      });

      const { rerender } = render(<ReplayControls />);

      // Initial time
      expect(screen.getByText('00:00 / 05:00')).toBeInTheDocument();

      // Update time to 2 minutes
      useReplayStore.getState().setCurrentTime(120000);
      rerender(<ReplayControls />);
      expect(screen.getByText('02:00 / 05:00')).toBeInTheDocument();

      // Update time to 4:30
      useReplayStore.getState().setCurrentTime(270000);
      rerender(<ReplayControls />);
      expect(screen.getByText('04:30 / 05:00')).toBeInTheDocument();
    });

    it('should handle short durations correctly', () => {
      useReplayStore.getState().enterReplayMode('session-123', {
        sessionStartTime: 1000,
        duration: 15000, // 15 seconds
        timelineItems: [],
        files: [],
      });

      render(<ReplayControls />);

      expect(screen.getByText('00:00 / 00:15')).toBeInTheDocument();
    });

    it('should handle long durations correctly', () => {
      useReplayStore.getState().enterReplayMode('session-123', {
        sessionStartTime: 1000,
        duration: 600000, // 10 minutes
        timelineItems: [],
        files: [],
      });

      render(<ReplayControls />);

      expect(screen.getByText('00:00 / 10:00')).toBeInTheDocument();
    });
  });

  describe('Styling and Accessibility', () => {
    it('should have proper aria-labels for play button', () => {
      useReplayStore.getState().enterReplayMode('session-123', {
        sessionStartTime: 1000,
        duration: 120000,
        timelineItems: [],
        files: [],
      });

      render(<ReplayControls />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Play playback');
    });

    it('should have proper aria-labels for pause button', () => {
      useReplayStore.getState().enterReplayMode('session-123', {
        sessionStartTime: 1000,
        duration: 120000,
        timelineItems: [],
        files: [],
      });
      useReplayStore.getState().play();

      render(<ReplayControls />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', 'Pause playback');
    });

    it('should apply design system classes to play/pause button', () => {
      useReplayStore.getState().enterReplayMode('session-123', {
        sessionStartTime: 1000,
        duration: 120000,
        timelineItems: [],
        files: [],
      });

      render(<ReplayControls />);

      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-gray-900', 'text-white');
    });

    it('should have monospace font for time display', () => {
      useReplayStore.getState().enterReplayMode('session-123', {
        sessionStartTime: 1000,
        duration: 120000,
        timelineItems: [],
        files: [],
      });

      const { container } = render(<ReplayControls />);

      const timeDisplay = container.querySelector('.font-mono');
      expect(timeDisplay).toBeInTheDocument();
      expect(timeDisplay).toHaveTextContent('00:00 / 02:00');
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero duration', () => {
      useReplayStore.getState().enterReplayMode('session-123', {
        sessionStartTime: 1000,
        duration: 0,
        timelineItems: [],
        files: [],
      });

      render(<ReplayControls />);

      expect(screen.getByText('00:00 / 00:00')).toBeInTheDocument();
    });

    it('should handle very large durations', () => {
      useReplayStore.getState().enterReplayMode('session-123', {
        sessionStartTime: 1000,
        duration: 3661000, // 61 minutes 1 second
        timelineItems: [],
        files: [],
      });

      render(<ReplayControls />);

      expect(screen.getByText('00:00 / 61:01')).toBeInTheDocument();
    });

    it('should handle currentTime exceeding duration', () => {
      useReplayStore.getState().enterReplayMode('session-123', {
        sessionStartTime: 1000,
        duration: 120000, // 2 minutes
        timelineItems: [],
        files: [],
      });
      useReplayStore.getState().setCurrentTime(180000); // 3 minutes

      render(<ReplayControls />);

      expect(screen.getByText('03:00 / 02:00')).toBeInTheDocument();
    });
  });
});
