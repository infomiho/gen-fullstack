import Markdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import { typography } from '../lib/design-tokens';

interface MarkdownMessageProps {
  content: string;
  className?: string;
}

/**
 * Renders markdown content with custom styling.
 *
 * Headings are styled to be small and understated while maintaining semantic HTML
 * for accessibility (screen readers, document navigation).
 *
 * Uses remark-breaks plugin to preserve single line breaks (GitHub Flavored Markdown).
 * This is necessary because LLM responses often use single newlines for formatting,
 * whereas standard CommonMark treats them as spaces.
 */
export function MarkdownMessage({ content, className = '' }: MarkdownMessageProps) {
  return (
    <div className={`prose prose-sm max-w-none ${className}`}>
      <Markdown
        remarkPlugins={[remarkBreaks]} // Convert single line breaks to <br> tags
        components={{
          // Style headings to be small and understated while maintaining semantic HTML
          // This preserves accessibility for screen readers while avoiding prominent titles
          h1: ({ children }) => (
            <h1 className="font-semibold text-base mb-2 mt-3 first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="font-semibold text-base mb-2 mt-3 first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-semibold text-sm mb-2 mt-2 first:mt-0">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="font-semibold text-sm mb-2 mt-2 first:mt-0">{children}</h4>
          ),
          h5: ({ children }) => (
            <h5 className="font-semibold text-sm mb-1 mt-2 first:mt-0">{children}</h5>
          ),
          h6: ({ children }) => (
            <h6 className="font-semibold text-sm mb-1 mt-2 first:mt-0">{children}</h6>
          ),
          // Style paragraphs
          p: ({ children }) => <p className={`mb-2 last:mb-0 ${typography.body}`}>{children}</p>,
          // Style code blocks
          code: ({ children, className }) => {
            // Code blocks have a language-* className, inline code does not
            const isCodeBlock = className?.startsWith('language-');

            if (isCodeBlock) {
              return (
                <code
                  className={`block bg-gray-100 p-3 rounded text-sm overflow-x-auto ${typography.mono} ${className}`}
                >
                  {children}
                </code>
              );
            }
            // Inline code
            return (
              <code className={`bg-gray-100 px-1.5 py-0.5 rounded text-sm ${typography.mono}`}>
                {children}
              </code>
            );
          },
          // Style pre blocks (wrap code blocks)
          pre: ({ children }) => <pre className="mb-2 last:mb-0 overflow-x-auto">{children}</pre>,
          // Style lists
          ul: ({ children }) => (
            <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>
          ),
          li: ({ children }) => <li className="text-sm">{children}</li>,
          // Style links
          a: ({ children, href }) => (
            <a
              href={href}
              className="text-blue-600 hover:text-blue-800 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          // Style blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-gray-300 pl-3 italic text-gray-700 mb-2">
              {children}
            </blockquote>
          ),
          // Style horizontal rules
          hr: () => <hr className="my-3 border-gray-300" />,
          // Style strong/bold
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          // Style emphasis/italic
          em: ({ children }) => <em className="italic">{children}</em>,
          // Style line breaks (from remark-breaks plugin)
          br: () => <br />,
        }}
      >
        {content}
      </Markdown>
    </div>
  );
}
