import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConfigBadge } from './ConfigBadge';

describe('ConfigBadge', () => {
  describe('Enabled state', () => {
    it('renders "Enabled" text with emerald styling when enabled is true', () => {
      render(<ConfigBadge enabled label="Planning" />);
      const badge = screen.getByText('Enabled');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-emerald-50', 'text-emerald-700', 'border-emerald-200');
    });

    it('renders label text with enabled status', () => {
      render(<ConfigBadge enabled label="Compiler Checks" />);
      expect(screen.getByText('Compiler Checks:')).toBeInTheDocument();
      expect(screen.getByText('Enabled')).toBeInTheDocument();
    });
  });

  describe('Disabled state', () => {
    it('renders "Disabled" text with gray styling when enabled is false', () => {
      render(<ConfigBadge enabled={false} label="Planning" />);
      const badge = screen.getByText('Disabled');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass('bg-gray-100', 'text-gray-700', 'border-gray-200');
    });

    it('renders label text with disabled status', () => {
      render(<ConfigBadge enabled={false} label="Compiler Checks" />);
      expect(screen.getByText('Compiler Checks:')).toBeInTheDocument();
      expect(screen.getByText('Disabled')).toBeInTheDocument();
    });
  });

  describe('Label variations', () => {
    it('renders "Planning" label', () => {
      render(<ConfigBadge enabled label="Planning" />);
      expect(screen.getByText('Planning:')).toBeInTheDocument();
    });

    it('renders "Compiler Checks" label', () => {
      render(<ConfigBadge enabled={false} label="Compiler Checks" />);
      expect(screen.getByText('Compiler Checks:')).toBeInTheDocument();
    });

    it('renders custom label text', () => {
      render(<ConfigBadge enabled label="Custom Feature" />);
      expect(screen.getByText('Custom Feature:')).toBeInTheDocument();
    });
  });

  describe('Layout', () => {
    it('renders with flex layout for label and badge', () => {
      const { container } = render(<ConfigBadge enabled label="Planning" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('flex', 'items-center', 'justify-between');
    });
  });
});
