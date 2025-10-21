import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PreviewControls } from './PreviewControls';

describe('PreviewControls', () => {
  describe('Reload button', () => {
    it('renders reload button', () => {
      const onReload = vi.fn();
      const onToggleFullscreen = vi.fn();
      render(
        <PreviewControls
          onReload={onReload}
          onToggleFullscreen={onToggleFullscreen}
          isFullscreen={false}
        />,
      );

      const reloadButton = screen.getByLabelText('Reload preview');
      expect(reloadButton).toBeInTheDocument();
    });

    it('calls onReload when reload button is clicked', async () => {
      const user = userEvent.setup();
      const onReload = vi.fn();
      const onToggleFullscreen = vi.fn();
      render(
        <PreviewControls
          onReload={onReload}
          onToggleFullscreen={onToggleFullscreen}
          isFullscreen={false}
        />,
      );

      const reloadButton = screen.getByLabelText('Reload preview');
      await user.click(reloadButton);

      expect(onReload).toHaveBeenCalledOnce();
      expect(onToggleFullscreen).not.toHaveBeenCalled();
    });

    it('shows reload icon (SVG)', () => {
      const onReload = vi.fn();
      const onToggleFullscreen = vi.fn();
      render(
        <PreviewControls
          onReload={onReload}
          onToggleFullscreen={onToggleFullscreen}
          isFullscreen={false}
        />,
      );

      const reloadIcon = screen.getByLabelText('Reload icon');
      expect(reloadIcon).toBeInTheDocument();
      expect(reloadIcon.tagName).toBe('svg');
    });
  });

  describe('Fullscreen toggle button', () => {
    it('renders fullscreen button with maximize icon when not fullscreen', () => {
      const onReload = vi.fn();
      const onToggleFullscreen = vi.fn();
      render(
        <PreviewControls
          onReload={onReload}
          onToggleFullscreen={onToggleFullscreen}
          isFullscreen={false}
        />,
      );

      const fullscreenButton = screen.getByLabelText('Enter fullscreen');
      expect(fullscreenButton).toBeInTheDocument();

      const maximizeIcon = screen.getByLabelText('Maximize icon');
      expect(maximizeIcon).toBeInTheDocument();
    });

    it('renders fullscreen button with minimize icon when fullscreen', () => {
      const onReload = vi.fn();
      const onToggleFullscreen = vi.fn();
      render(
        <PreviewControls
          onReload={onReload}
          onToggleFullscreen={onToggleFullscreen}
          isFullscreen
        />,
      );

      const fullscreenButton = screen.getByLabelText('Exit fullscreen');
      expect(fullscreenButton).toBeInTheDocument();

      const minimizeIcon = screen.getByLabelText('Minimize icon');
      expect(minimizeIcon).toBeInTheDocument();
    });

    it('calls onToggleFullscreen when fullscreen button is clicked', async () => {
      const user = userEvent.setup();
      const onReload = vi.fn();
      const onToggleFullscreen = vi.fn();
      render(
        <PreviewControls
          onReload={onReload}
          onToggleFullscreen={onToggleFullscreen}
          isFullscreen={false}
        />,
      );

      const fullscreenButton = screen.getByLabelText('Enter fullscreen');
      await user.click(fullscreenButton);

      expect(onToggleFullscreen).toHaveBeenCalledOnce();
      expect(onReload).not.toHaveBeenCalled();
    });
  });

  describe('Button states and accessibility', () => {
    it('has proper button types', () => {
      const onReload = vi.fn();
      const onToggleFullscreen = vi.fn();
      render(
        <PreviewControls
          onReload={onReload}
          onToggleFullscreen={onToggleFullscreen}
          isFullscreen={false}
        />,
      );

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(2);
      buttons.forEach((button) => {
        expect(button).toHaveAttribute('type', 'button');
      });
    });

    it('has descriptive titles for hover tooltips', () => {
      const onReload = vi.fn();
      const onToggleFullscreen = vi.fn();
      render(
        <PreviewControls
          onReload={onReload}
          onToggleFullscreen={onToggleFullscreen}
          isFullscreen={false}
        />,
      );

      const reloadButton = screen.getByLabelText('Reload preview');
      expect(reloadButton).toHaveAttribute('title', 'Reload preview');

      const fullscreenButton = screen.getByLabelText('Enter fullscreen');
      expect(fullscreenButton).toHaveAttribute('title', 'Enter fullscreen');
    });

    it('updates fullscreen button title when toggled', () => {
      const onReload = vi.fn();
      const onToggleFullscreen = vi.fn();
      const { rerender } = render(
        <PreviewControls
          onReload={onReload}
          onToggleFullscreen={onToggleFullscreen}
          isFullscreen={false}
        />,
      );

      expect(screen.getByLabelText('Enter fullscreen')).toBeInTheDocument();

      rerender(
        <PreviewControls
          onReload={onReload}
          onToggleFullscreen={onToggleFullscreen}
          isFullscreen
        />,
      );

      expect(screen.getByLabelText('Exit fullscreen')).toBeInTheDocument();
    });
  });

  describe('Layout', () => {
    it('renders buttons in horizontal flex layout', () => {
      const onReload = vi.fn();
      const onToggleFullscreen = vi.fn();
      const { container } = render(
        <PreviewControls
          onReload={onReload}
          onToggleFullscreen={onToggleFullscreen}
          isFullscreen={false}
        />,
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('flex', 'items-center', 'gap-2');
    });

    it('applies hover styles to buttons', () => {
      const onReload = vi.fn();
      const onToggleFullscreen = vi.fn();
      render(
        <PreviewControls
          onReload={onReload}
          onToggleFullscreen={onToggleFullscreen}
          isFullscreen={false}
        />,
      );

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toHaveClass('hover:bg-gray-100');
      });
    });
  });
});
