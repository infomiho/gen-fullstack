import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from './StatusBadge';

describe('StatusBadge', () => {
  describe('Session statuses', () => {
    it('renders completed status with green dot and border', () => {
      render(<StatusBadge status="completed" />);
      const badge = screen.getByText('completed');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-card', 'border-green-600', 'text-green-700');
    });

    it('renders generating status with blue dot and border', () => {
      render(<StatusBadge status="generating" />);
      const badge = screen.getByText('generating');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-card', 'border-blue-600', 'text-blue-700');
    });

    it('renders failed status with red dot and border', () => {
      render(<StatusBadge status="failed" />);
      const badge = screen.getByText('failed');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-card', 'border-red-600', 'text-red-700');
    });

    it('renders stopped status with gray dot and border', () => {
      render(<StatusBadge status="stopped" />);
      const badge = screen.getByText('stopped');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-card', 'border-gray-600', 'text-gray-700');
    });
  });

  describe('App execution statuses', () => {
    it('renders creating status with blue dot and border', () => {
      render(<StatusBadge status="creating" variant="app" />);
      const badge = screen.getByText('creating');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-card', 'border-blue-600', 'text-blue-700');
    });

    it('renders installing status with blue dot and border', () => {
      render(<StatusBadge status="installing" variant="app" />);
      const badge = screen.getByText('installing');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-card', 'border-blue-600', 'text-blue-700');
    });

    it('renders starting status with blue dot and border', () => {
      render(<StatusBadge status="starting" variant="app" />);
      const badge = screen.getByText('starting');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-card', 'border-blue-600', 'text-blue-700');
    });

    it('renders ready status with amber dot and border', () => {
      render(<StatusBadge status="ready" variant="app" />);
      const badge = screen.getByText('ready');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-card', 'border-amber-600', 'text-amber-700');
    });

    it('renders running status with green dot and border', () => {
      render(<StatusBadge status="running" variant="app" />);
      const badge = screen.getByText('running');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-card', 'border-green-600', 'text-green-700');
    });

    it('renders stopped status with gray dot and border', () => {
      render(<StatusBadge status="stopped" variant="app" />);
      const badge = screen.getByText('stopped');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-card', 'border-gray-600', 'text-gray-700');
    });
  });

  describe('Live indicator', () => {
    it('shows pulsing indicator when showLiveIndicator is true for generating status', () => {
      render(<StatusBadge status="generating" showLiveIndicator />);
      const badge = screen.getByText('generating');
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

    it('shows regular dot indicator when not showing live indicator', () => {
      render(<StatusBadge status="generating" showLiveIndicator={false} />);
      const badge = screen.getByText('generating');
      expect(badge).toBeInTheDocument();

      // Should have a static dot indicator
      const container = badge.parentElement;
      const staticDot = container?.querySelector('.bg-blue-600');
      expect(staticDot).toBeInTheDocument();
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
    it('always applies border class for consistent design', () => {
      render(<StatusBadge status="running" variant="app" />);
      const badge = screen.getByText('running');
      expect(badge).toHaveClass('border');
    });

    it('applies border class for default variant', () => {
      render(<StatusBadge status="generating" variant="default" />);
      const badge = screen.getByText('generating');
      expect(badge).toHaveClass('border');
    });

    it('applies border class for session variant', () => {
      render(<StatusBadge status="generating" variant="session" />);
      const badge = screen.getByText('generating');
      expect(badge).toHaveClass('border');
    });

    it('uses app variant padding', () => {
      render(<StatusBadge status="running" variant="app" />);
      const badge = screen.getByText('running');
      expect(badge).toHaveClass('px-2', 'py-1');
    });

    it('uses default variant padding', () => {
      render(<StatusBadge status="generating" variant="default" />);
      const badge = screen.getByText('generating');
      expect(badge).toHaveClass('px-2.5', 'py-1');
    });
  });
});
