import type { LLMMessage, ToolCall, ToolResult } from '@gen-fullstack/shared';
import { Bot } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState } from './EmptyState';
import { MessageItem } from './timeline/MessageItem';
import { type ToolExecution, ToolItem } from './timeline/ToolItem';

interface TimelineProps {
  messages: LLMMessage[];
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
}

type TimelineItem =
  | { type: 'message'; data: LLMMessage; timestamp: number }
  | { type: 'tool'; data: ToolExecution; timestamp: number };

/**
 * Timeline Component
 *
 * Displays a unified timeline of messages and tool calls in chronological order.
 * Tool calls can be clicked to view details in a modal dialog.
 */
export function Timeline({ messages, toolCalls, toolResults }: TimelineProps) {
  // Track which tool dialog is open (by tool ID)
  // This state is lifted to Timeline to persist across re-renders
  const [openToolId, setOpenToolId] = useState<string | null>(null);

  const toolExecutions = useMemo(() => {
    const resultsMap = new Map<string, ToolResult>();
    toolResults.forEach((result) => {
      const toolCallId = result.id.replace('result-', '');
      resultsMap.set(toolCallId, result);
    });

    return toolCalls.map((toolCall) => {
      const result = resultsMap.get(toolCall.id);
      return {
        id: toolCall.id,
        name: toolCall.name,
        args: toolCall.args,
        result: result?.result,
        isComplete: !!result,
        isError: result?.isError || false,
        timestamp: toolCall.timestamp,
      };
    });
  }, [toolCalls, toolResults]);

  const timeline = useMemo(() => {
    const items: TimelineItem[] = [];

    // Add messages with their real timestamps
    messages.forEach((message) => {
      items.push({
        type: 'message',
        data: message,
        timestamp: message.timestamp,
      });
    });

    // Add tool executions with their real timestamps
    toolExecutions.forEach((tool) => {
      items.push({
        type: 'tool',
        data: tool,
        timestamp: tool.timestamp,
      });
    });

    // Sort by timestamp in reverse (newest first)
    return items.sort((a, b) => b.timestamp - a.timestamp);
  }, [messages, toolExecutions]);

  if (timeline.length === 0) {
    return (
      <EmptyState
        icon={<Bot size={48} />}
        title="No activity yet"
        description="Start generating to see LLM interactions..."
      />
    );
  }

  return (
    <div className="space-y-4">
      {timeline.map((item, index) =>
        item.type === 'message' ? (
          <MessageItem key={`${item.data.id}-${index}`} message={item.data} />
        ) : (
          <ToolItem
            key={`${item.data.id}-${index}`}
            tool={item.data}
            isOpen={openToolId === item.data.id}
            onOpenChange={(open) => setOpenToolId(open ? item.data.id : null)}
          />
        ),
      )}
    </div>
  );
}
