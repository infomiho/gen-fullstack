import type { LLMMessage } from '@gen-fullstack/shared';
import { Bot, Terminal, User } from 'lucide-react';
import { padding, radius, roleColors, typography } from '../../lib/design-tokens';
import { formatTimestamp } from '../../lib/time-utils';
import { MarkdownMessage } from '../MarkdownMessage';

export interface MessageItemProps {
  /** The message to display */
  message: LLMMessage;
}

/**
 * MessageItem component - displays a single LLM message in the timeline
 *
 * Shows message role (user, assistant, system) with appropriate icon and styling.
 * Renders markdown content and timestamp.
 *
 * @example
 * ```tsx
 * <MessageItem message={{ role: 'assistant', content: '...', timestamp: Date.now() }} />
 * ```
 */
export function MessageItem({ message }: MessageItemProps) {
  const colors = roleColors[message.role as keyof typeof roleColors];

  return (
    <div className={`flex gap-3 ${radius.md} ${padding.card} border ${colors.bg} ${colors.border}`}>
      <div className="flex-shrink-0">
        {message.role === 'assistant' ? (
          <Bot size={20} className={colors.icon} />
        ) : message.role === 'user' ? (
          <User size={20} className={colors.icon} />
        ) : (
          <Terminal size={20} className={colors.icon} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className={`${typography.caption} font-semibold uppercase`}>{message.role}</div>
          <div className={`${typography.monoSm} text-gray-600 dark:text-gray-400`}>
            {formatTimestamp(message.timestamp)}
          </div>
        </div>
        <MarkdownMessage content={message.content} />
      </div>
    </div>
  );
}
