import { Bot, Terminal, User } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Need to scroll when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-gray-400">
        <div className="text-center">
          <Bot size={48} className="mx-auto mb-4 opacity-50" />
          <p>No messages yet. Start generating to see LLM interactions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {messages.map((message, index) => (
        <div
          key={`msg-${index}-${message.role}-${message.content.length}-${message.content.slice(0, 30).replace(/\s/g, '')}`}
          className={`flex gap-3 rounded-lg p-4 ${
            message.role === 'assistant'
              ? 'bg-blue-50'
              : message.role === 'user'
                ? 'bg-gray-50'
                : 'bg-yellow-50'
          }`}
        >
          <div className="flex-shrink-0">
            {message.role === 'assistant' ? (
              <Bot size={20} className="text-blue-600" />
            ) : message.role === 'user' ? (
              <User size={20} className="text-gray-600" />
            ) : (
              <Terminal size={20} className="text-yellow-600" />
            )}
          </div>
          <div className="flex-1">
            <div className="mb-1 text-xs font-semibold uppercase text-gray-500">{message.role}</div>
            <div className="whitespace-pre-wrap text-sm text-gray-800">{message.content}</div>
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}
