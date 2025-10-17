import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { FilterButton } from './FilterButton';

describe('FilterButton', () => {
  describe('Basic Rendering', () => {
    it('should render with label', () => {
      render(<FilterButton label="All" isActive={false} onClick={() => {}} />);
      expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    });

    it('should render as a button element', () => {
      render(<FilterButton label="Test" isActive={false} onClick={() => {}} />);
      const button = screen.getByRole('button');
      expect(button.tagName).toBe('BUTTON');
      expect(button).toHaveAttribute('type', 'button');
    });
  });

  describe('Active State', () => {
    it('should apply active styles when isActive is true', () => {
      render(<FilterButton label="Active" isActive={true} onClick={() => {}} />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-gray-900', 'text-white');
    });

    it('should apply inactive styles when isActive is false', () => {
      render(<FilterButton label="Inactive" isActive={false} onClick={() => {}} />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-gray-100', 'text-gray-700', 'hover:bg-gray-200');
    });

    it('should toggle appearance when isActive changes', () => {
      const { rerender } = render(
        <FilterButton label="Toggle" isActive={false} onClick={() => {}} />,
      );

      let button = screen.getByRole('button');
      expect(button).toHaveClass('bg-gray-100');

      rerender(<FilterButton label="Toggle" isActive={true} onClick={() => {}} />);

      button = screen.getByRole('button');
      expect(button).toHaveClass('bg-gray-900', 'text-white');
    });
  });

  describe('Click Handling', () => {
    it('should call onClick when clicked', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(<FilterButton label="Clickable" isActive={false} onClick={handleClick} />);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should call onClick when active button is clicked', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(<FilterButton label="Active Click" isActive={true} onClick={handleClick} />);

      await user.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should allow multiple clicks', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(<FilterButton label="Multi Click" isActive={false} onClick={handleClick} />);

      const button = screen.getByRole('button');
      await user.click(button);
      await user.click(button);
      await user.click(button);

      expect(handleClick).toHaveBeenCalledTimes(3);
    });
  });

  describe('Variant Styles', () => {
    it('should apply gray variant styles (default)', () => {
      const { rerender } = render(<FilterButton label="Gray" isActive={true} onClick={() => {}} />);

      let button = screen.getByRole('button');
      expect(button).toHaveClass('bg-gray-900', 'text-white');

      rerender(<FilterButton label="Gray" isActive={false} onClick={() => {}} />);

      button = screen.getByRole('button');
      expect(button).toHaveClass('bg-gray-100', 'text-gray-700');
    });

    it('should apply purple variant styles', () => {
      const { rerender } = render(
        <FilterButton label="Purple" isActive={true} onClick={() => {}} variant="purple" />,
      );

      let button = screen.getByRole('button');
      expect(button).toHaveClass('bg-purple-600', 'text-white');

      rerender(
        <FilterButton label="Purple" isActive={false} onClick={() => {}} variant="purple" />,
      );

      button = screen.getByRole('button');
      expect(button).toHaveClass('bg-gray-100', 'text-gray-700');
    });

    it('should apply yellow variant styles', () => {
      render(<FilterButton label="Yellow" isActive={true} onClick={() => {}} variant="yellow" />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-yellow-600', 'text-white');
    });

    it('should apply blue variant styles', () => {
      render(<FilterButton label="Blue" isActive={true} onClick={() => {}} variant="blue" />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-blue-600', 'text-white');
    });

    it('should apply amber variant styles', () => {
      render(<FilterButton label="Amber" isActive={true} onClick={() => {}} variant="amber" />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-amber-600', 'text-white');
    });

    it('should apply red variant styles', () => {
      render(<FilterButton label="Red" isActive={true} onClick={() => {}} variant="red" />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-red-600', 'text-white');
    });

    it('should maintain inactive styles across all variants', () => {
      const variants: Array<'gray' | 'purple' | 'yellow' | 'blue' | 'amber' | 'red'> = [
        'gray',
        'purple',
        'yellow',
        'blue',
        'amber',
        'red',
      ];

      for (const variant of variants) {
        const { unmount } = render(
          <FilterButton label={variant} isActive={false} onClick={() => {}} variant={variant} />,
        );

        const button = screen.getByRole('button', { name: variant });
        expect(button).toHaveClass('bg-gray-100', 'text-gray-700', 'hover:bg-gray-200');

        unmount();
      }
    });
  });

  describe('Common Classes', () => {
    it('should always apply common button classes', () => {
      render(<FilterButton label="Common" isActive={false} onClick={() => {}} />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('px-2', 'py-1', 'text-xs', 'rounded', 'transition-colors');
    });

    it('should maintain common classes when toggling active state', () => {
      const { rerender } = render(
        <FilterButton label="Toggle" isActive={false} onClick={() => {}} />,
      );

      let button = screen.getByRole('button');
      expect(button).toHaveClass('px-2', 'py-1', 'text-xs', 'rounded', 'transition-colors');

      rerender(<FilterButton label="Toggle" isActive={true} onClick={() => {}} />);

      button = screen.getByRole('button');
      expect(button).toHaveClass('px-2', 'py-1', 'text-xs', 'rounded', 'transition-colors');
    });
  });

  describe('Filter Group Scenario', () => {
    it('should work in a filter group with multiple buttons', async () => {
      const user = userEvent.setup();
      const filters = [
        { value: 'all', label: 'All', variant: 'gray' as const },
        { value: 'command', label: 'Commands', variant: 'purple' as const },
        { value: 'error', label: 'Error', variant: 'red' as const },
      ];

      const handleFilterChange = vi.fn();

      render(
        <div>
          {filters.map((filter) => (
            <FilterButton
              key={filter.value}
              label={filter.label}
              isActive={filter.value === 'all'}
              onClick={() => handleFilterChange(filter.value)}
              variant={filter.variant}
            />
          ))}
        </div>,
      );

      // All should be active (gray background)
      const allButton = screen.getByRole('button', { name: 'All' });
      expect(allButton).toHaveClass('bg-gray-900');

      // Commands should be inactive
      const commandsButton = screen.getByRole('button', { name: 'Commands' });
      expect(commandsButton).toHaveClass('bg-gray-100');

      // Click Commands button
      await user.click(commandsButton);
      expect(handleFilterChange).toHaveBeenCalledWith('command');

      // Click Error button
      const errorButton = screen.getByRole('button', { name: 'Error' });
      await user.click(errorButton);
      expect(handleFilterChange).toHaveBeenCalledWith('error');

      expect(handleFilterChange).toHaveBeenCalledTimes(2);
    });
  });

  describe('Accessibility', () => {
    it('should be keyboard accessible', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      render(<FilterButton label="Keyboard" isActive={false} onClick={handleClick} />);

      const button = screen.getByRole('button');

      // Focus the button
      await user.tab();
      expect(button).toHaveFocus();

      // Press Enter
      await user.keyboard('{Enter}');
      expect(handleClick).toHaveBeenCalledTimes(1);

      // Press Space
      await user.keyboard(' ');
      expect(handleClick).toHaveBeenCalledTimes(2);
    });

    it('should have appropriate role and text content', () => {
      render(<FilterButton label="Accessible Label" isActive={false} onClick={() => {}} />);

      const button = screen.getByRole('button', { name: 'Accessible Label' });
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('Accessible Label');
    });
  });
});
