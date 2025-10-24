import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { Bot, FileText } from 'lucide-react';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  describe('Basic Rendering', () => {
    it('should render with title only', () => {
      render(<EmptyState title="No data" />);
      expect(screen.getByText('No data')).toBeInTheDocument();
    });

    it('should render with title and description', () => {
      render(
        <EmptyState title="No messages yet" description="Start generating to see interactions" />,
      );

      expect(screen.getByText('No messages yet')).toBeInTheDocument();
      expect(screen.getByText('Start generating to see interactions')).toBeInTheDocument();
    });

    it('should render with icon', () => {
      render(<EmptyState icon={<Bot data-testid="bot-icon" size={48} />} title="No messages" />);

      expect(screen.getByTestId('bot-icon')).toBeInTheDocument();
      expect(screen.getByText('No messages')).toBeInTheDocument();
    });

    it('should render with action button', () => {
      render(
        <EmptyState
          title="No app running"
          description="Click below to start"
          action={<button type="button">Start App</button>}
        />,
      );

      expect(screen.getByText('No app running')).toBeInTheDocument();
      expect(screen.getByText('Click below to start')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Start App' })).toBeInTheDocument();
    });
  });

  describe('Custom Styling', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <EmptyState title="Custom styled" className="bg-muted rounded-lg p-8" />,
      );

      const emptyStateDiv = container.firstChild as HTMLElement;
      expect(emptyStateDiv).toHaveClass('bg-muted', 'rounded-lg', 'p-8');
    });

    it('should maintain default classes with custom className', () => {
      const { container } = render(<EmptyState title="Test" className="custom-class" />);

      const emptyStateDiv = container.firstChild as HTMLElement;
      expect(emptyStateDiv).toHaveClass(
        'flex',
        'h-full',
        'items-center',
        'justify-center',
        'custom-class',
      );
    });
  });

  describe('Icon Display', () => {
    it('should not render icon container when icon is not provided', () => {
      const { container } = render(<EmptyState title="No icon" />);

      // Check that there's no div with opacity-50 class (icon container)
      const opacityDivs = container.querySelectorAll('.opacity-50');
      expect(opacityDivs.length).toBe(0);
    });

    it('should render icon with proper centering classes', () => {
      render(<EmptyState icon={<Bot data-testid="bot-icon" size={48} />} title="Test" />);

      const iconContainer = screen.getByTestId('bot-icon').parentElement;
      expect(iconContainer).toHaveClass('flex', 'justify-center', 'mb-4', 'opacity-50');
    });

    it('should support different icon components', () => {
      const { rerender } = render(
        <EmptyState icon={<Bot data-testid="bot-icon" size={48} />} title="Bot" />,
      );

      expect(screen.getByTestId('bot-icon')).toBeInTheDocument();

      rerender(<EmptyState icon={<FileText data-testid="file-icon" size={48} />} title="File" />);

      expect(screen.queryByTestId('bot-icon')).not.toBeInTheDocument();
      expect(screen.getByTestId('file-icon')).toBeInTheDocument();
    });
  });

  describe('Content Layout', () => {
    it('should center all content horizontally and vertically', () => {
      const { container } = render(<EmptyState title="Centered" />);

      const outerDiv = container.firstChild as HTMLElement;
      expect(outerDiv).toHaveClass('flex', 'h-full', 'items-center', 'justify-center');

      const innerDiv = outerDiv.firstChild as HTMLElement;
      expect(innerDiv).toHaveClass('text-center');
    });

    it('should render description below title', () => {
      render(<EmptyState title="Title" description="Description" />);

      const description = screen.getByText('Description');

      // Description should have mt-1 class (margin-top)
      expect(description).toHaveClass('mt-1');
    });

    it('should render action below description', () => {
      render(
        <EmptyState
          title="Title"
          description="Description"
          action={<button type="button">Action</button>}
        />,
      );

      const button = screen.getByRole('button');
      const buttonContainer = button.parentElement;

      // Action container should have mt-4 class
      expect(buttonContainer).toHaveClass('mt-4');
    });
  });

  describe('Text Styling', () => {
    it('should apply correct text styles to title', () => {
      render(<EmptyState title="Styled Title" />);

      const title = screen.getByText('Styled Title');
      expect(title).toHaveClass('text-sm', 'text-muted-foreground');
    });

    it('should apply correct text styles to description', () => {
      render(<EmptyState title="Title" description="Styled Description" />);

      const description = screen.getByText('Styled Description');
      expect(description).toHaveClass('mt-1', 'text-xs', 'text-muted-foreground');
    });
  });

  describe('Complete Examples', () => {
    it('should render complete empty state with all props', () => {
      render(
        <EmptyState
          icon={<Bot data-testid="bot-icon" size={48} />}
          title="No messages yet"
          description="Start generating to see LLM interactions"
          action={
            <button type="button" className="px-4 py-2 bg-gray-900 text-white rounded">
              Start Generating
            </button>
          }
          className="min-h-[400px]"
        />,
      );

      expect(screen.getByTestId('bot-icon')).toBeInTheDocument();
      expect(screen.getByText('No messages yet')).toBeInTheDocument();
      expect(screen.getByText('Start generating to see LLM interactions')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Start Generating' })).toBeInTheDocument();
    });
  });
});
