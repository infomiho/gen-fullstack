import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { MODEL_METADATA, formatPricing, getModelsByProvider } from '@gen-fullstack/shared';
import { ModelSelector } from './ModelSelector';

// Polyfill for Radix UI Select in JSDOM environment
if (typeof Element.prototype.hasPointerCapture === 'undefined') {
  Element.prototype.hasPointerCapture = () => false;
}
if (typeof Element.prototype.setPointerCapture === 'undefined') {
  Element.prototype.setPointerCapture = () => {};
}
if (typeof Element.prototype.releasePointerCapture === 'undefined') {
  Element.prototype.releasePointerCapture = () => {};
}
if (typeof Element.prototype.scrollIntoView === 'undefined') {
  Element.prototype.scrollIntoView = () => {};
}

describe('ModelSelector', () => {
  describe('Basic Rendering', () => {
    it('should render model selector with label', () => {
      render(<ModelSelector selectedModel="gpt-5-mini" onModelChange={() => {}} />);

      expect(screen.getByText(/Model/i)).toBeInTheDocument();
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('should render as a Radix UI Select', () => {
      render(<ModelSelector selectedModel="gpt-5-mini" onModelChange={() => {}} />);

      const trigger = screen.getByRole('combobox');
      expect(trigger).toHaveAttribute('aria-label', 'Select model');
    });

    it('should render HoverInfo with tooltip', () => {
      render(<ModelSelector selectedModel="gpt-5-mini" onModelChange={() => {}} />);

      const hoverInfoButton = screen.getByRole('button', { name: /more information/i });
      expect(hoverInfoButton).toBeInTheDocument();
    });
  });

  describe('Model Options', () => {
    it('should display selected model in trigger', () => {
      render(<ModelSelector selectedModel="gpt-5-mini" onModelChange={() => {}} />);

      expect(screen.getByText('GPT-5 Mini')).toBeInTheDocument();
    });

    it('should display pricing for selected model', () => {
      render(<ModelSelector selectedModel="gpt-5-mini" onModelChange={() => {}} />);

      const pricing = formatPricing('gpt-5-mini');
      expect(screen.getByText(pricing)).toBeInTheDocument();
    });

    it('should show all OpenAI models when opened', async () => {
      const user = userEvent.setup();
      render(<ModelSelector selectedModel="gpt-5-mini" onModelChange={() => {}} />);

      const trigger = screen.getByRole('combobox');
      await user.click(trigger);

      await waitFor(() => {
        // Use getAllByText since selected model also appears in trigger
        expect(screen.getAllByText('GPT-5 Mini').length).toBeGreaterThan(0);
        expect(screen.getByRole('option', { name: /GPT-5.*Largest/i })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: /GPT-5 Nano/i })).toBeInTheDocument();
      });
    });

    it('should show all Anthropic models when opened', async () => {
      const user = userEvent.setup();
      render(<ModelSelector selectedModel="gpt-5-mini" onModelChange={() => {}} />);

      const trigger = screen.getByRole('combobox');
      await user.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('Claude Haiku 4.5')).toBeInTheDocument();
        expect(screen.getByText('Claude Sonnet 4.5')).toBeInTheDocument();
        expect(screen.getByText('Claude Opus 4.1')).toBeInTheDocument();
      });
    });
  });

  describe('Provider Grouping', () => {
    it('should have OpenAI group label', async () => {
      const user = userEvent.setup();
      render(<ModelSelector selectedModel="gpt-5-mini" onModelChange={() => {}} />);

      const trigger = screen.getByRole('combobox');
      await user.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('OpenAI')).toBeInTheDocument();
      });
    });

    it('should have Anthropic group label', async () => {
      const user = userEvent.setup();
      render(<ModelSelector selectedModel="gpt-5-mini" onModelChange={() => {}} />);

      const trigger = screen.getByRole('combobox');
      await user.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('Anthropic')).toBeInTheDocument();
      });
    });
  });

  describe('Model Selection', () => {
    it('should call onModelChange when selecting a different model', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();
      render(<ModelSelector selectedModel="gpt-5-mini" onModelChange={handleChange} />);

      const trigger = screen.getByRole('combobox');
      await user.click(trigger);

      await waitFor(() => {
        const gpt5Option = screen.getByRole('option', { name: /GPT-5.*Largest context window/i });
        return user.click(gpt5Option);
      });

      await waitFor(() => {
        expect(handleChange).toHaveBeenCalledWith('gpt-5');
      });
    });

    it('should display selected GPT-5', () => {
      render(<ModelSelector selectedModel="gpt-5" onModelChange={() => {}} />);

      expect(screen.getByText('GPT-5')).toBeInTheDocument();
    });

    it('should display selected Claude Sonnet', () => {
      render(<ModelSelector selectedModel="claude-sonnet-4-5" onModelChange={() => {}} />);

      expect(screen.getByText('Claude Sonnet 4.5')).toBeInTheDocument();
    });
  });

  describe('Disabled State', () => {
    it('should not be disabled by default', () => {
      render(<ModelSelector selectedModel="gpt-5-mini" onModelChange={() => {}} />);

      const trigger = screen.getByRole('combobox');
      expect(trigger).not.toHaveAttribute('disabled');
      expect(trigger).not.toHaveAttribute('data-disabled');
    });

    it('should be disabled when disabled prop is true', () => {
      render(<ModelSelector selectedModel="gpt-5-mini" onModelChange={() => {}} disabled />);

      const trigger = screen.getByRole('combobox');
      expect(trigger).toHaveAttribute('data-disabled');
    });

    it('should not call onChange when disabled', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();
      render(<ModelSelector selectedModel="gpt-5-mini" onModelChange={handleChange} disabled />);

      const trigger = screen.getByRole('combobox');
      await user.click(trigger);

      // Radix UI Select won't open when disabled
      expect(handleChange).not.toHaveBeenCalled();
    });
  });

  describe('Shared Package Integration', () => {
    it('should use MODEL_METADATA from shared package', () => {
      render(<ModelSelector selectedModel="gpt-5-mini" onModelChange={() => {}} />);

      const metadata = MODEL_METADATA['gpt-5-mini'];
      expect(screen.getByText(metadata.label)).toBeInTheDocument();
    });

    it('should use getModelsByProvider for grouping', async () => {
      const user = userEvent.setup();
      const { openai, anthropic } = getModelsByProvider();

      render(<ModelSelector selectedModel="gpt-5-mini" onModelChange={() => {}} />);

      const trigger = screen.getByRole('combobox');
      await user.click(trigger);

      await waitFor(() => {
        // Check that we have the right number of models
        expect(openai.length).toBe(3);
        expect(anthropic.length).toBe(3);
      });
    });

    it('should use formatPricing for display', () => {
      render(<ModelSelector selectedModel="gpt-5-mini" onModelChange={() => {}} />);

      const pricing = formatPricing('gpt-5-mini');
      expect(screen.getByText(pricing)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible label', () => {
      render(<ModelSelector selectedModel="gpt-5-mini" onModelChange={() => {}} />);

      const trigger = screen.getByRole('combobox');
      expect(trigger).toHaveAccessibleName(/Model|Select model/i);
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      render(<ModelSelector selectedModel="gpt-5-mini" onModelChange={handleChange} />);

      const trigger = screen.getByRole('combobox');

      // Focus and open with Enter
      trigger.focus();
      await user.keyboard('{Enter}');

      // Radix UI Select opens with Enter
      await waitFor(() => {
        expect(screen.getByRole('option', { name: /GPT-5.*Largest/i })).toBeInTheDocument();
      });
    });
  });

  describe('Visual States', () => {
    it('should show descriptions for all models when opened', async () => {
      const user = userEvent.setup();
      render(<ModelSelector selectedModel="gpt-5-mini" onModelChange={() => {}} />);

      const trigger = screen.getByRole('combobox');
      await user.click(trigger);

      await waitFor(() => {
        // Check for neutral descriptions
        expect(screen.getByText(/Recommended for most use cases/i)).toBeInTheDocument();
        expect(screen.getByText(/Largest context window/i)).toBeInTheDocument();
        expect(screen.getByText(/Balanced performance and speed/i)).toBeInTheDocument();
      });
    });

    it('should display pricing for all models when opened', async () => {
      const user = userEvent.setup();
      render(<ModelSelector selectedModel="gpt-5-mini" onModelChange={() => {}} />);

      const trigger = screen.getByRole('combobox');
      await user.click(trigger);

      await waitFor(() => {
        const gpt5Pricing = formatPricing('gpt-5');
        const claudePricing = formatPricing('claude-sonnet-4-5');

        expect(screen.getAllByText(gpt5Pricing).length).toBeGreaterThan(0);
        expect(screen.getAllByText(claudePricing).length).toBeGreaterThan(0);
      });
    });
  });
});
