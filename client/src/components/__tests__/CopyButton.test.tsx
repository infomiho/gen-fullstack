import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CopyButton } from '../CopyButton';

describe('CopyButton', () => {
  const mockWriteText = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock clipboard API using Object.defineProperty
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: mockWriteText,
      },
      writable: true,
      configurable: true,
    });
  });

  it('renders copy button with default title', () => {
    render(<CopyButton text="Hello world" />);
    const button = screen.getByRole('button', { name: /copy/i });
    expect(button).toBeInTheDocument();
  });

  it('renders copy button with custom title', () => {
    render(<CopyButton text="Code snippet" title="Copy code" />);
    const button = screen.getByRole('button', { name: /copy code/i });
    expect(button).toBeInTheDocument();
  });

  it('copies text to clipboard when clicked', async () => {
    mockWriteText.mockResolvedValueOnce(undefined);

    render(<CopyButton text="Hello world" />);
    const button = screen.getByRole('button', { name: /copy/i });

    await button.click();

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith('Hello world');
    });
  });

  it('shows checkmark after successful copy', async () => {
    const user = userEvent.setup();
    mockWriteText.mockResolvedValueOnce(undefined);

    render(<CopyButton text="Hello world" />);
    const button = screen.getByRole('button', { name: /copy/i });

    await user.click(button);

    // Check for checkmark (success state)
    await waitFor(() => {
      expect(button).toHaveAttribute('title', 'Copied!');
    });
  });

  it('reverts to copy icon after 2 seconds', async () => {
    mockWriteText.mockResolvedValueOnce(undefined);

    render(<CopyButton text="Hello world" />);
    const button = screen.getByRole('button', { name: /copy/i });

    await button.click();

    // Should show copied state
    await waitFor(() => {
      expect(button).toHaveAttribute('title', 'Copied!');
    });

    // Wait for the 2 second timeout
    await waitFor(
      () => {
        expect(button).toHaveAttribute('title', 'Copy');
      },
      { timeout: 2500 },
    );
  });

  it('handles clipboard API errors gracefully', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Set up clipboard mock to fail for this test
    const failingWriteText = vi
      .fn()
      .mockRejectedValueOnce(new Error('Clipboard API not available'));
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: failingWriteText,
      },
      writable: true,
      configurable: true,
    });

    render(<CopyButton text="Hello world" />);
    const button = screen.getByRole('button', { name: /copy/i });

    await button.click();

    // Wait for the error to be logged
    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to copy text:', expect.any(Error));
    });

    consoleErrorSpy.mockRestore();
  });

  it('prevents event propagation when clicked', async () => {
    const parentClickHandler = vi.fn();
    mockWriteText.mockResolvedValueOnce(undefined);

    render(
      // biome-ignore lint/a11y/noStaticElementInteractions: Testing click propagation
      // biome-ignore lint/a11y/useKeyWithClickEvents: Testing click propagation
      <div onClick={parentClickHandler}>
        <CopyButton text="Hello world" />
      </div>,
    );

    const button = screen.getByRole('button', { name: /copy/i });
    button.click();

    await waitFor(
      () => {
        // Parent handler should not be called (event.stopPropagation())
        expect(parentClickHandler).not.toHaveBeenCalled();
      },
      { timeout: 500 },
    );
  });

  it('applies custom className', () => {
    render(<CopyButton text="Hello world" className="custom-class" />);
    const button = screen.getByRole('button', { name: /copy/i });
    expect(button).toHaveClass('custom-class');
  });

  it('uses custom icon size', () => {
    const { container } = render(<CopyButton text="Hello world" iconSize={20} />);
    const icon = container.querySelector('svg');
    expect(icon).toHaveAttribute('width', '20');
    expect(icon).toHaveAttribute('height', '20');
  });
});
