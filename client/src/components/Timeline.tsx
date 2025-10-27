import type { LLMMessage, ToolCall, ToolResult } from '@gen-fullstack/shared';
import { Bot } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState } from './EmptyState';
import { MessageItem } from './timeline/MessageItem';
import { SkeletonLoader } from './timeline/SkeletonLoader';
import { type ToolExecution, ToolItem } from './timeline/ToolItem';

interface TimelineProps {
  messages: LLMMessage[];
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
  /** Whether generation is currently in progress */
  isGenerating?: boolean;
}

type TimelineItem =
  | { type: 'message'; data: LLMMessage; timestamp: number }
  | { type: 'tool'; data: ToolExecution; timestamp: number };

/**
 * Timeline Component
 *
 * Displays a unified timeline of messages and tool calls in chronological order.
 * Tool calls can be clicked to view details in a modal dialog.
 * Shows a skeleton loader at the top when generation is in progress.
 */
export function Timeline({
  messages,
  toolCalls,
  toolResults,
  isGenerating = false,
}: TimelineProps) {
  // Track which tool dialog is open (by tool ID)
  // This state is lifted to Timeline to persist across re-renders
  const [openToolId, setOpenToolId] = useState<string | null>(null);

  // Track which sections are expanded in PlanArchitectureDisplay for each tool
  // Key: `${toolId}-${sectionName}`, Value: boolean (true = expanded)
  // This state is lifted to Timeline to persist across re-renders when new data arrives
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // Toggle a section's expanded state
  const toggleSection = (toolId: string, section: string) => {
    const key = `${toolId}-${section}`;
    setExpandedSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Get whether a section is expanded
  const isSectionExpanded = (toolId: string, section: string): boolean => {
    const key = `${toolId}-${section}`;
    return expandedSections[key] ?? false;
  };

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
        reason: toolCall.reason,
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

  // Show empty state only if not generating and no timeline items
  if (timeline.length === 0 && !isGenerating) {
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
      {/* Show skeleton loader at top when generating */}
      {isGenerating && <SkeletonLoader />}

      {timeline.map((item, index) =>
        item.type === 'message' ? (
          <MessageItem key={`${item.data.id}-${index}`} message={item.data} />
        ) : (
          <ToolItem
            key={`${item.data.id}-${index}`}
            tool={item.data}
            isOpen={openToolId === item.data.id}
            onOpenChange={(open) => setOpenToolId(open ? item.data.id : null)}
            isSectionExpanded={isSectionExpanded}
            onToggleSection={toggleSection}
          />
        ),
      )}
    </div>
  );
}
