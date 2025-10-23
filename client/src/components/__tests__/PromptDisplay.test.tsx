import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PromptDisplay } from '../PromptDisplay';

describe('PromptDisplay', () => {
  const mockWriteText = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock clipboard API
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: mockWriteText,
      },
      writable: true,
      configurable: true,
    });
  });

  it('renders the prompt text', () => {
    render(<PromptDisplay prompt="Build a todo app" />);
    expect(screen.getByText('Build a todo app')).toBeInTheDocument();
  });

  it('renders with gray background and border', () => {
    const { container } = render(<PromptDisplay prompt="Test prompt" />);
    const wrapper = container.querySelector('.bg-gray-50.border.border-gray-200.rounded');
    expect(wrapper).toBeInTheDocument();
  });

  it('renders copy button', () => {
    render(<PromptDisplay prompt="Build a todo app" />);
    const copyButton = screen.getByRole('button', { name: /copy prompt/i });
    expect(copyButton).toBeInTheDocument();
  });

  it('copies prompt to clipboard when copy button is clicked', async () => {
    mockWriteText.mockResolvedValueOnce(undefined);

    render(<PromptDisplay prompt="Build a todo app" />);
    const copyButton = screen.getByRole('button', { name: /copy prompt/i });

    copyButton.click();

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith('Build a todo app');
    });
  });

  it('preserves whitespace in multiline prompts', () => {
    const multilinePrompt = 'Line 1\nLine 2\nLine 3';
    render(<PromptDisplay prompt={multilinePrompt} />);

    // Check that the element has whitespace-pre-wrap class
    const promptText = screen.getByText(/Line 1/);
    expect(promptText).toHaveClass('whitespace-pre-wrap');
    // Verify content is present
    expect(promptText.textContent).toBe(multilinePrompt);
  });

  it('positions copy button absolutely in top-right corner', () => {
    const { container } = render(<PromptDisplay prompt="Test prompt" />);
    const buttonWrapper = container.querySelector('.absolute.top-2.right-2');
    expect(buttonWrapper).toBeInTheDocument();
  });

  it('adds padding-right to text to avoid overlap with copy button', () => {
    render(<PromptDisplay prompt="Test prompt" />);
    const promptText = screen.getByText('Test prompt');
    expect(promptText).toHaveClass('pr-6');
  });

  it('applies custom className', () => {
    const { container } = render(<PromptDisplay prompt="Test prompt" className="custom-class" />);
    const wrapper = container.querySelector('.custom-class');
    expect(wrapper).toBeInTheDocument();
  });

  it('handles long prompts without breaking layout', () => {
    const longPrompt =
      'This is a very long prompt that spans multiple lines and contains a lot of text to test how the component handles long content without breaking the layout or overlapping with the copy button.';
    render(<PromptDisplay prompt={longPrompt} />);

    const promptText = screen.getByText(longPrompt);
    expect(promptText).toBeInTheDocument();
    expect(promptText).toHaveClass('leading-relaxed');
  });

  it('renders with consistent typography styles', () => {
    render(<PromptDisplay prompt="Test prompt" />);
    const promptText = screen.getByText('Test prompt');
    expect(promptText).toHaveClass('text-sm', 'text-gray-700');
  });
});
