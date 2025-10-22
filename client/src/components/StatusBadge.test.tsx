import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  describe('Session statuses', () => {
    it('renders completed status with gray styling', () => {
      render(<StatusBadge status="completed" />);
      const badge = screen.getByText('completed');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-gray-100', 'text-gray-700');
    });

    it('renders generating status with blue styling', () => {
      render(<StatusBadge status="generating" />);
      const badge = screen.getByText('generating');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-blue-100', 'text-blue-700');
    });

    it('renders failed status with red styling', () => {
      render(<StatusBadge status="failed" />);
      const badge = screen.getByText('failed');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-red-100', 'text-red-700');
    });
  });

  describe('App execution statuses', () => {
    it('renders creating status with blue styling', () => {
      render(<StatusBadge status="creating" variant="app" />);
      const badge = screen.getByText('creating');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-blue-100', 'text-blue-800', 'border-blue-200');
    });

    it('renders installing status with blue styling', () => {
      render(<StatusBadge status="installing" variant="app" />);
      const badge = screen.getByText('installing');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-blue-100', 'text-blue-800', 'border-blue-200');
    });

    it('renders starting status with blue styling', () => {
      render(<StatusBadge status="starting" variant="app" />);
      const badge = screen.getByText('starting');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-blue-100', 'text-blue-800', 'border-blue-200');
    });

    it('renders ready status with amber styling', () => {
      render(<StatusBadge status="ready" variant="app" />);
      const badge = screen.getByText('ready');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-amber-100', 'text-amber-800', 'border-amber-200');
    });

    it('renders running status with green styling', () => {
      render(<StatusBadge status="running" variant="app" />);
      const badge = screen.getByText('running');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-green-100', 'text-green-800', 'border-green-200');
    });

    it('renders stopped status with gray styling', () => {
      render(<StatusBadge status="stopped" variant="app" />);
      const badge = screen.getByText('stopped');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-gray-100', 'text-gray-700');
    });
  });

  describe('Live indicator', () => {
    it('shows "Live" text and pulsing indicator when showLiveIndicator is true for generating status', () => {
      render(<StatusBadge status="generating" showLiveIndicator />);
      const badge = screen.getByText('Live');
      expect(badge).toBeInTheDocument();

      // Check for pulsing animation elements
      const container = badge.parentElement;
      const pulsingElements = container?.querySelectorAll('.animate-ping');
      expect(pulsingElements).toHaveLength(1);
    });

    it('does not show live indicator when showLiveIndicator is false', () => {
      render(<StatusBadge status="generating" showLiveIndicator={false} />);
      const badge = screen.getByText('generating');
      expect(badge).toBeInTheDocument();

      const container = badge.parentElement;
      const pulsingElements = container?.querySelectorAll('.animate-ping');
      expect(pulsingElements).toHaveLength(0);
    });

    it('does not show live indicator for non-generating statuses', () => {
      render(<StatusBadge status="completed" showLiveIndicator />);
      const badge = screen.getByText('completed');
      expect(badge).toBeInTheDocument();

      const container = badge.parentElement;
      const pulsingElements = container?.querySelectorAll('.animate-ping');
      expect(pulsingElements).toHaveLength(0);
    });
  });

  describe('Custom display text', () => {
    it('renders custom display text when provided', () => {
      render(<StatusBadge status="completed" displayText="Done" />);
      const badge = screen.getByText('Done');
      expect(badge).toBeInTheDocument();
    });
  });

  describe('Uppercase styling', () => {
    it('applies uppercase class when uppercase prop is true', () => {
      render(<StatusBadge status="running" uppercase />);
      const badge = screen.getByText('running');
      expect(badge).toHaveClass('uppercase');
    });

    it('does not apply uppercase class when uppercase prop is false', () => {
      render(<StatusBadge status="running" uppercase={false} />);
      const badge = screen.getByText('running');
      expect(badge).not.toHaveClass('uppercase');
    });
  });

  describe('Variant styling', () => {
    it('applies border class for app variant', () => {
      render(<StatusBadge status="running" variant="app" />);
      const badge = screen.getByText('running');
      expect(badge).toHaveClass('border');
    });

    it('does not apply border class for default variant', () => {
      render(<StatusBadge status="generating" variant="default" />);
      const badge = screen.getByText('generating');
      expect(badge).not.toHaveClass('border');
    });

    it('does not apply border class for session variant', () => {
      render(<StatusBadge status="generating" variant="session" />);
      const badge = screen.getByText('generating');
      expect(badge).not.toHaveClass('border');
    });
  });
});
