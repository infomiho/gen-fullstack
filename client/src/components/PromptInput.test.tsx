import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { PromptInput } from './PromptInput';

describe('PromptInput Component', () => {
  describe('Basic Rendering', () => {
    it('should render as a textarea element', () => {
      render(<PromptInput value="" onChange={() => {}} />);
      const textarea = screen.getByRole('textbox');
      expect(textarea.tagName).toBe('TEXTAREA');
    });

    it('should render with 5 rows', () => {
      render(<PromptInput value="" onChange={() => {}} />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('rows', '5');
    });

    it('should render with custom id', () => {
      // biome-ignore lint/correctness/useUniqueElementIds: Testing id prop functionality
      render(<PromptInput value="" onChange={() => {}} id="custom-prompt" />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveAttribute('id', 'custom-prompt');
    });

    it('should apply text-xl class for larger text', () => {
      render(<PromptInput value="" onChange={() => {}} />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveClass('text-xl');
    });

    it('should apply placeholder styling', () => {
      render(<PromptInput value="" onChange={() => {}} />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveClass('placeholder:text-gray-400');
    });
  });

  describe('Value and onChange', () => {
    it('should display the current value', () => {
      render(<PromptInput value="Test prompt" onChange={() => {}} />);
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe('Test prompt');
    });

    it('should call onChange when user types', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      render(<PromptInput value="" onChange={handleChange} />);
      const textarea = screen.getByRole('textbox');

      await user.type(textarea, 'New');

      expect(handleChange).toHaveBeenCalledTimes(3); // 'N', 'e', 'w'
    });

    it('should be controlled by value prop', () => {
      const { rerender } = render(<PromptInput value="First" onChange={() => {}} />);

      let textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe('First');

      rerender(<PromptInput value="Second" onChange={() => {}} />);

      textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe('Second');
    });
  });

  describe('Disabled State', () => {
    it('should be enabled by default', () => {
      render(<PromptInput value="" onChange={() => {}} />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).not.toBeDisabled();
    });

    it('should be disabled when disabled prop is true', () => {
      render(<PromptInput value="" onChange={() => {}} disabled={true} />);
      const textarea = screen.getByRole('textbox');
      expect(textarea).toBeDisabled();
    });

    it('should not call onChange when disabled', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      render(<PromptInput value="" onChange={handleChange} disabled={true} />);
      const textarea = screen.getByRole('textbox');

      await user.type(textarea, 'Should not work');

      expect(handleChange).not.toHaveBeenCalled();
    });
  });

  describe('Placeholder Animation', () => {
    it('should start with empty placeholder', () => {
      render(<PromptInput value="" onChange={() => {}} />);
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.placeholder).toBe('');
    });

    it('should clear placeholder when user has typed something', () => {
      render(<PromptInput value="User input" onChange={() => {}} />);
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.placeholder).toBe('');
    });

    it('should not show placeholder when value is provided', () => {
      const { rerender } = render(<PromptInput value="" onChange={() => {}} />);
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;

      // Initially might have animation starting
      rerender(<PromptInput value="Some text" onChange={() => {}} />);

      // Placeholder should be empty when user types
      expect(textarea.placeholder).toBe('');
    });
  });

  describe('Accessibility', () => {
    it('should be keyboard accessible', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      render(<PromptInput value="" onChange={handleChange} />);
      const textarea = screen.getByRole('textbox');

      // Focus with Tab
      await user.tab();
      expect(textarea).toHaveFocus();

      // Type with keyboard
      await user.keyboard('Test');
      expect(handleChange).toHaveBeenCalled();
    });

    it('should have textbox role for screen readers', () => {
      render(<PromptInput value="" onChange={() => {}} />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });
});
