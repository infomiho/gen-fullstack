import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConfigValue } from './ConfigValue';

describe('ConfigValue', () => {
  describe('Basic rendering', () => {
    it('renders label and value', () => {
      render(<ConfigValue label="Input Mode" value="Template" />);
      expect(screen.getByText('Input Mode:')).toBeInTheDocument();
      expect(screen.getByText('Template')).toBeInTheDocument();
    });

    it('renders with different label and value combinations', () => {
      render(<ConfigValue label="Model" value="gpt-5-mini" />);
      expect(screen.getByText('Model:')).toBeInTheDocument();
      expect(screen.getByText('gpt-5-mini')).toBeInTheDocument();
    });
  });

  describe('Variant styling', () => {
    it('applies blue styling by default', () => {
      render(<ConfigValue label="Input Mode" value="Naive" />);
      const badge = screen.getByText('Naive');
      expect(badge).toHaveClass('bg-blue-50', 'text-blue-700', 'border-blue-200');
    });

    it('applies blue styling when variant is explicitly set to blue', () => {
      render(<ConfigValue label="Input Mode" value="Template" variant="blue" />);
      const badge = screen.getByText('Template');
      expect(badge).toHaveClass('bg-blue-50', 'text-blue-700', 'border-blue-200');
    });

    it('applies purple styling when variant is purple', () => {
      render(<ConfigValue label="Model" value="gpt-5" variant="purple" />);
      const badge = screen.getByText('gpt-5');
      expect(badge).toHaveClass('bg-purple-50', 'text-purple-700', 'border-purple-200');
    });

    it('applies gray styling when variant is gray', () => {
      render(<ConfigValue label="Status" value="Idle" variant="gray" />);
      const badge = screen.getByText('Idle');
      expect(badge).toHaveClass('bg-gray-100', 'text-gray-700', 'border-gray-200');
    });
  });

  describe('Common usage patterns', () => {
    it('renders Input Mode value (SessionSidebar pattern)', () => {
      render(<ConfigValue label="Input Mode" value="Template" />);
      expect(screen.getByText('Input Mode:')).toBeInTheDocument();
      expect(screen.getByText('Template')).toBeInTheDocument();
    });

    it('handles Naive input mode', () => {
      render(<ConfigValue label="Input Mode" value="Naive" />);
      expect(screen.getByText('Naive')).toBeInTheDocument();
    });
  });

  describe('Layout', () => {
    it('renders with flex layout for label and value', () => {
      const { container } = render(<ConfigValue label="Input Mode" value="Template" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('flex', 'items-center', 'justify-between');
    });
  });
});
