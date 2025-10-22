import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { type ToolExecution, ToolItem } from './ToolItem';

describe('ToolItem', () => {
  const baseTool: ToolExecution = {
    id: 'tool-1',
    name: 'writeFile',
    args: { path: '/test.txt', content: 'Hello' },
    isComplete: true,
    result: 'File written successfully',
    timestamp: Date.now(),
  };

  describe('Tool execution display', () => {
    it('renders tool name', () => {
      const onOpenChange = vi.fn();
      render(<ToolItem tool={baseTool} isOpen={false} onOpenChange={onOpenChange} />);

      expect(screen.getByText('writeFile')).toBeInTheDocument();
    });

    it('shows completed indicator (●) when tool is complete', () => {
      const onOpenChange = vi.fn();
      render(<ToolItem tool={baseTool} isOpen={false} onOpenChange={onOpenChange} />);

      expect(screen.getByText('●')).toBeInTheDocument();
    });

    it('shows incomplete indicator (○) and "running..." when tool is not complete', () => {
      const incompleteTool: ToolExecution = { ...baseTool, isComplete: false, result: undefined };
      const onOpenChange = vi.fn();
      render(<ToolItem tool={incompleteTool} isOpen={false} onOpenChange={onOpenChange} />);

      expect(screen.getByText('○')).toBeInTheDocument();
      expect(screen.getByText('running...')).toBeInTheDocument();
    });

    it('displays tool summary (via getToolSummary utility)', () => {
      const onOpenChange = vi.fn();
      render(<ToolItem tool={baseTool} isOpen={false} onOpenChange={onOpenChange} />);

      // getToolSummary generates summary from tool name and args
      // For writeFile with path, it should show the path
      expect(screen.getByText(/test\.txt/)).toBeInTheDocument();
    });
  });

  describe('Dialog interaction', () => {
    it('calls onOpenChange when clicked', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      render(<ToolItem tool={baseTool} isOpen={false} onOpenChange={onOpenChange} />);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(onOpenChange).toHaveBeenCalledWith(true);
    });

    it('shows dialog when isOpen is true', () => {
      const onOpenChange = vi.fn();
      render(<ToolItem tool={baseTool} isOpen onOpenChange={onOpenChange} />);

      // Dialog content should be visible
      expect(screen.getByText('Parameters')).toBeInTheDocument();
      expect(screen.getByText('Result')).toBeInTheDocument();
    });

    it('displays parameters in dialog', () => {
      const onOpenChange = vi.fn();
      render(<ToolItem tool={baseTool} isOpen onOpenChange={onOpenChange} />);

      expect(screen.getByText('Parameters')).toBeInTheDocument();
      // renderToolParameters will show the args - check for "path:" label
      expect(screen.getByText('path:')).toBeInTheDocument();
      // And the actual path value
      expect(screen.getByText('/test.txt')).toBeInTheDocument();
    });

    it('displays result in dialog when tool is complete', () => {
      const onOpenChange = vi.fn();
      render(<ToolItem tool={baseTool} isOpen onOpenChange={onOpenChange} />);

      expect(screen.getByText('Result')).toBeInTheDocument();
      expect(screen.getByText('File written successfully')).toBeInTheDocument();
    });

    it('does not display result section when tool is incomplete', () => {
      const incompleteTool: ToolExecution = { ...baseTool, isComplete: false, result: undefined };
      const onOpenChange = vi.fn();
      render(<ToolItem tool={incompleteTool} isOpen onOpenChange={onOpenChange} />);

      expect(screen.queryByText('Result')).not.toBeInTheDocument();
    });

    it('shows Complete status in dialog for completed tools', () => {
      const onOpenChange = vi.fn();
      render(<ToolItem tool={baseTool} isOpen onOpenChange={onOpenChange} />);

      expect(screen.getByText('Complete')).toBeInTheDocument();
    });

    it('shows Running status in dialog for incomplete tools', () => {
      const incompleteTool: ToolExecution = { ...baseTool, isComplete: false, result: undefined };
      const onOpenChange = vi.fn();
      render(<ToolItem tool={incompleteTool} isOpen onOpenChange={onOpenChange} />);

      expect(screen.getByText('Running')).toBeInTheDocument();
    });
  });

  describe('Different tool types', () => {
    it('renders readFile tool', () => {
      const tool: ToolExecution = {
        id: 'tool-2',
        name: 'readFile',
        args: { path: '/config.json' },
        isComplete: true,
        result: '{"key":"value"}',
        timestamp: Date.now(),
      };
      const onOpenChange = vi.fn();
      render(<ToolItem tool={tool} isOpen={false} onOpenChange={onOpenChange} />);

      expect(screen.getByText('readFile')).toBeInTheDocument();
    });

    it('renders executeCommand tool', () => {
      const tool: ToolExecution = {
        id: 'tool-3',
        name: 'executeCommand',
        args: { command: 'npm install' },
        isComplete: false,
        timestamp: Date.now(),
      };
      const onOpenChange = vi.fn();
      render(<ToolItem tool={tool} isOpen={false} onOpenChange={onOpenChange} />);

      expect(screen.getByText('executeCommand')).toBeInTheDocument();
      expect(screen.getByText('running...')).toBeInTheDocument();
    });
  });

  describe('Timestamp display', () => {
    it('displays formatted timestamp', () => {
      const onOpenChange = vi.fn();
      render(<ToolItem tool={baseTool} isOpen={false} onOpenChange={onOpenChange} />);

      // Timestamp is formatted by formatTimestamp utility
      const container = screen.getByText('writeFile').closest('button');
      const timestampElements = container?.querySelectorAll('.font-mono');
      expect(timestampElements?.length).toBeGreaterThan(0);
    });
  });
});
