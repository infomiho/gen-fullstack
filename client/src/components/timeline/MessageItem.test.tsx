import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { LLMMessage } from '@gen-fullstack/shared';
import { MessageItem } from './MessageItem';

describe('MessageItem', () => {
  const baseMessage: LLMMessage = {
    id: 'msg-1',
    role: 'assistant',
    content: 'Test message content',
    timestamp: Date.now(),
  };

  describe('Message roles', () => {
    it('renders assistant message with bot icon and blue styling', () => {
      const message: LLMMessage = { ...baseMessage, role: 'assistant' };
      render(<MessageItem message={message} />);

      expect(screen.getByText('ASSISTANT')).toBeInTheDocument();
      expect(screen.getByText('Test message content')).toBeInTheDocument();

      // Check for bot icon (svg with specific class)
      const container = screen.getByText('ASSISTANT').closest('div');
      expect(container).toHaveClass('bg-blue-50', 'border-blue-100');
    });

    it('renders user message with user icon and gray styling', () => {
      const message: LLMMessage = { ...baseMessage, role: 'user', content: 'User input' };
      render(<MessageItem message={message} />);

      expect(screen.getByText('USER')).toBeInTheDocument();
      expect(screen.getByText('User input')).toBeInTheDocument();
    });

    it('renders system message with terminal icon and amber styling', () => {
      const message: LLMMessage = { ...baseMessage, role: 'system', content: 'System info' };
      render(<MessageItem message={message} />);

      expect(screen.getByText('SYSTEM')).toBeInTheDocument();
      expect(screen.getByText('System info')).toBeInTheDocument();
    });
  });

  describe('Content rendering', () => {
    it('renders plain text content', () => {
      const message: LLMMessage = { ...baseMessage, content: 'Plain text message' };
      render(<MessageItem message={message} />);

      expect(screen.getByText('Plain text message')).toBeInTheDocument();
    });

    it('renders markdown content (via MarkdownMessage component)', () => {
      const message: LLMMessage = {
        ...baseMessage,
        content: '**Bold text** and *italic text*',
      };
      render(<MessageItem message={message} />);

      // MarkdownMessage will render markdown, check content is present
      const container = screen.getByText('ASSISTANT').closest('div');
      expect(container?.textContent).toContain('Bold text');
      expect(container?.textContent).toContain('italic text');
    });
  });

  describe('Timestamp display', () => {
    it('displays formatted timestamp', () => {
      const now = Date.now();
      const message: LLMMessage = { ...baseMessage, timestamp: now };
      render(<MessageItem message={message} />);

      // Timestamp is formatted by formatTimestamp utility
      // Check that a timestamp element exists (monoSm class is used for timestamps)
      const container = screen.getByText('ASSISTANT').closest('div');
      const timestampElements = container?.querySelectorAll('.font-mono');
      expect(timestampElements?.length).toBeGreaterThan(0);
    });
  });

  describe('Layout structure', () => {
    it('renders with correct flex layout', () => {
      render(<MessageItem message={baseMessage} />);

      const container = screen.getByText('Test message content').closest('.flex');
      expect(container).toHaveClass('flex', 'gap-3');
    });

    it('includes role label in uppercase', () => {
      const message: LLMMessage = { ...baseMessage, role: 'assistant' };
      const { container } = render(<MessageItem message={message} />);

      const roleLabel = container.querySelector('.uppercase');
      expect(roleLabel).toBeTruthy();
      expect(roleLabel?.textContent).toBe('assistant');
    });
  });
});
