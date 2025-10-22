import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarkdownMessage } from '../MarkdownMessage';

describe('MarkdownMessage', () => {
  describe('Headings', () => {
    it('renders h1 with semantic HTML and custom styling', () => {
      const { container } = render(<MarkdownMessage content="# Heading 1" />);
      const h1 = container.querySelector('h1');
      expect(h1).toBeTruthy();
      expect(h1?.className).toContain('font-semibold');
      expect(screen.getByText('Heading 1')).toBeInTheDocument();
    });

    it('renders h2 with semantic HTML and custom styling', () => {
      const { container } = render(<MarkdownMessage content="## Heading 2" />);
      const h2 = container.querySelector('h2');
      expect(h2).toBeTruthy();
      expect(h2?.className).toContain('font-semibold');
      expect(screen.getByText('Heading 2')).toBeInTheDocument();
    });

    it('renders h3 with semantic HTML and custom styling', () => {
      const { container } = render(<MarkdownMessage content="### Heading 3" />);
      const h3 = container.querySelector('h3');
      expect(h3).toBeTruthy();
      expect(h3?.className).toContain('font-semibold');
      expect(screen.getByText('Heading 3')).toBeInTheDocument();
    });

    it('renders multiple headings with proper semantic hierarchy', () => {
      const markdown = `# Title\n## Subtitle\n### Section`;
      const { container } = render(<MarkdownMessage content={markdown} />);

      // All semantic heading tags should be present
      expect(container.querySelector('h1')).toBeTruthy();
      expect(container.querySelector('h2')).toBeTruthy();
      expect(container.querySelector('h3')).toBeTruthy();

      // Content should be accessible
      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('Subtitle')).toBeInTheDocument();
      expect(screen.getByText('Section')).toBeInTheDocument();
    });
  });

  describe('Paragraphs', () => {
    it('renders plain text paragraphs', () => {
      render(<MarkdownMessage content="This is a paragraph." />);
      expect(screen.getByText('This is a paragraph.')).toBeInTheDocument();
    });

    it('renders multiple paragraphs', () => {
      const markdown = `First paragraph.\n\nSecond paragraph.`;
      render(<MarkdownMessage content={markdown} />);
      expect(screen.getByText('First paragraph.')).toBeInTheDocument();
      expect(screen.getByText('Second paragraph.')).toBeInTheDocument();
    });
  });

  describe('Text formatting', () => {
    it('renders bold text', () => {
      render(<MarkdownMessage content="This is **bold** text." />);
      const boldElement = screen.getByText('bold');
      expect(boldElement.tagName).toBe('STRONG');
    });

    it('renders italic text', () => {
      render(<MarkdownMessage content="This is *italic* text." />);
      const italicElement = screen.getByText('italic');
      expect(italicElement.tagName).toBe('EM');
    });

    it('renders bold and italic together', () => {
      const markdown = 'This has **bold** and *italic* text.';
      render(<MarkdownMessage content={markdown} />);
      expect(screen.getByText('bold')).toBeInTheDocument();
      expect(screen.getByText('italic')).toBeInTheDocument();
    });
  });

  describe('Code', () => {
    it('renders inline code', () => {
      render(<MarkdownMessage content="Use `const` for constants." />);
      const codeElement = screen.getByText('const');
      expect(codeElement.tagName).toBe('CODE');
      expect(codeElement.className).toContain('bg-gray-100');
    });

    it('renders code blocks', () => {
      const markdown = '```\nconst x = 1;\n```';
      render(<MarkdownMessage content={markdown} />);
      expect(screen.getByText(/const x = 1;/)).toBeInTheDocument();
    });

    it('renders code blocks with language identifier', () => {
      const markdown = '```javascript\nconst x = 1;\n```';
      render(<MarkdownMessage content={markdown} />);
      expect(screen.getByText(/const x = 1;/)).toBeInTheDocument();
    });
  });

  describe('Lists', () => {
    it('renders unordered lists', () => {
      const markdown = `- Item 1\n- Item 2\n- Item 3`;
      render(<MarkdownMessage content={markdown} />);
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
      expect(screen.getByText('Item 3')).toBeInTheDocument();
    });

    it('renders ordered lists', () => {
      const markdown = `1. First\n2. Second\n3. Third`;
      render(<MarkdownMessage content={markdown} />);
      expect(screen.getByText('First')).toBeInTheDocument();
      expect(screen.getByText('Second')).toBeInTheDocument();
      expect(screen.getByText('Third')).toBeInTheDocument();
    });

    it('renders nested lists', () => {
      const markdown = `- Item 1\n  - Nested 1\n  - Nested 2\n- Item 2`;
      render(<MarkdownMessage content={markdown} />);
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Nested 1')).toBeInTheDocument();
      expect(screen.getByText('Nested 2')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
    });
  });

  describe('Links', () => {
    it('renders links with correct attributes', () => {
      const markdown = '[Click here](https://example.com)';
      render(<MarkdownMessage content={markdown} />);
      const link = screen.getByText('Click here');
      expect(link.tagName).toBe('A');
      expect(link).toHaveAttribute('href', 'https://example.com');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('renders multiple links', () => {
      const markdown = '[Link 1](https://example.com) and [Link 2](https://test.com)';
      render(<MarkdownMessage content={markdown} />);
      expect(screen.getByText('Link 1')).toHaveAttribute('href', 'https://example.com');
      expect(screen.getByText('Link 2')).toHaveAttribute('href', 'https://test.com');
    });
  });

  describe('Blockquotes', () => {
    it('renders blockquotes', () => {
      const markdown = '> This is a quote';
      const { container } = render(<MarkdownMessage content={markdown} />);
      const blockquote = container.querySelector('blockquote');
      expect(blockquote).toBeTruthy();
      expect(screen.getByText('This is a quote')).toBeInTheDocument();
    });

    it('renders multi-line blockquotes', () => {
      const markdown = '> Line 1\n> Line 2\n> Line 3';
      const { container } = render(<MarkdownMessage content={markdown} />);
      const blockquote = container.querySelector('blockquote');
      expect(blockquote).toBeTruthy();
    });
  });

  describe('Horizontal rules', () => {
    it('renders horizontal rules', () => {
      const markdown = 'Text before\n\n---\n\nText after';
      const { container } = render(<MarkdownMessage content={markdown} />);
      const hr = container.querySelector('hr');
      expect(hr).toBeTruthy();
      expect(screen.getByText('Text before')).toBeInTheDocument();
      expect(screen.getByText('Text after')).toBeInTheDocument();
    });
  });

  describe('Complex markdown', () => {
    it('renders mixed content correctly', () => {
      const markdown = `
# Title

This is a **bold** paragraph with *italic* text and \`inline code\`.

## Section

- List item 1
- List item 2

\`\`\`javascript
const x = 1;
\`\`\`

[Visit example](https://example.com)

> Important quote
      `.trim();

      render(<MarkdownMessage content={markdown} />);

      // Check various elements are present
      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('bold')).toBeInTheDocument();
      expect(screen.getByText('italic')).toBeInTheDocument();
      expect(screen.getByText('inline code')).toBeInTheDocument();
      expect(screen.getByText('Section')).toBeInTheDocument();
      expect(screen.getByText('List item 1')).toBeInTheDocument();
      expect(screen.getByText('List item 2')).toBeInTheDocument();
      expect(screen.getByText(/const x = 1;/)).toBeInTheDocument();
      expect(screen.getByText('Visit example')).toBeInTheDocument();
      expect(screen.getByText('Important quote')).toBeInTheDocument();
    });
  });

  describe('Custom className', () => {
    it('applies custom className', () => {
      const { container } = render(<MarkdownMessage content="Test" className="custom-class" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain('custom-class');
    });

    it('preserves default classes with custom className', () => {
      const { container } = render(<MarkdownMessage content="Test" className="custom-class" />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.className).toContain('prose');
      expect(wrapper.className).toContain('custom-class');
    });
  });

  describe('Edge cases', () => {
    it('renders empty string', () => {
      const { container } = render(<MarkdownMessage content="" />);
      expect(container.textContent).toBe('');
    });

    it('renders plain text without markdown', () => {
      render(<MarkdownMessage content="Just plain text" />);
      expect(screen.getByText('Just plain text')).toBeInTheDocument();
    });

    it('handles special characters', () => {
      const markdown = 'Text with < > & " characters';
      render(<MarkdownMessage content={markdown} />);
      expect(screen.getByText(/Text with < > & "/)).toBeInTheDocument();
    });
  });
});
