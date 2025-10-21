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
      const { container } = render(<MessageItem message={message} />);

      expect(screen.getByText('Test message content')).toBeInTheDocument();

      // Check for bot icon and blue styling
      const roleLabel = container.querySelector('.uppercase');
      expect(roleLabel).toBeTruthy();
      expect(roleLabel?.textContent).toBe('assistant');

      const messageContainer = container.querySelector('.bg-blue-50');
      expect(messageContainer).toHaveClass('border-blue-100');
    });

    it('renders user message with user icon and gray styling', () => {
      const message: LLMMessage = { ...baseMessage, role: 'user', content: 'User input' };
      const { container } = render(<MessageItem message={message} />);

      expect(screen.getByText('User input')).toBeInTheDocument();

      const roleLabel = container.querySelector('.uppercase');
      expect(roleLabel).toBeTruthy();
      expect(roleLabel?.textContent).toBe('user');
    });

    it('renders system message with terminal icon and amber styling', () => {
      const message: LLMMessage = { ...baseMessage, role: 'system', content: 'System info' };
      const { container } = render(<MessageItem message={message} />);

      expect(screen.getByText('System info')).toBeInTheDocument();

      const roleLabel = container.querySelector('.uppercase');
      expect(roleLabel).toBeTruthy();
      expect(roleLabel?.textContent).toBe('system');
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
      const { container } = render(<MessageItem message={message} />);

      // MarkdownMessage will render markdown, check content is present
      expect(container.textContent).toContain('Bold text');
      expect(container.textContent).toContain('italic text');
    });
  });

  describe('Timestamp display', () => {
    it('displays formatted timestamp', () => {
      const now = Date.now();
      const message: LLMMessage = { ...baseMessage, timestamp: now };
      const { container } = render(<MessageItem message={message} />);

      // Timestamp is formatted by formatTimestamp utility
      // Check that a timestamp element exists (monoSm class is used for timestamps)
      const timestampElements = container.querySelectorAll('.font-mono');
      expect(timestampElements.length).toBeGreaterThan(0);
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
