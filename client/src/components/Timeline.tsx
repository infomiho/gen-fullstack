import type { LLMMessage, ToolCall, ToolResult } from '@gen-fullstack/shared';
import * as Dialog from '@radix-ui/react-dialog';
import { Bot, Terminal, User, Wrench, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  focus,
  padding,
  radius,
  roleColors,
  spacing,
  transitions,
  typography,
} from '../lib/design-tokens';

interface TimelineProps {
  messages: LLMMessage[];
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
}

type TimelineItem =
  | { type: 'message'; data: LLMMessage; timestamp: number }
  | { type: 'tool'; data: ToolExecution; timestamp: number };

interface ToolExecution {
  id: string;
  name: string;
  args: Record<string, unknown> | undefined;
  result?: string;
  isComplete: boolean;
  timestamp: number;
}

/**
 * Format timestamp to HH:MM:SS.mmm format
 */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  const ms = date.getMilliseconds().toString().padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${ms}`;
}

/**
 * Timeline Component
 *
 * Displays a unified timeline of messages and tool calls in chronological order.
 * Tool calls can be clicked to view details in a modal dialog.
 */
export function Timeline({ messages, toolCalls, toolResults }: TimelineProps) {
  // Merge tool calls with their results
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
        timestamp: toolCall.timestamp,
      };
    });
  }, [toolCalls, toolResults]);

  // Create unified timeline
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
      <div className="flex h-full items-center justify-center text-gray-400">
        <div className="text-center">
          <Bot size={48} className="mx-auto mb-4 opacity-50" />
          <p>No activity yet. Start generating to see LLM interactions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {timeline.map((item, index) =>
        item.type === 'message' ? (
          <MessageItem key={`${item.data.id}-${index}`} message={item.data} />
        ) : (
          <ToolItem key={`${item.data.id}-${index}`} tool={item.data} />
        ),
      )}
    </div>
  );
}

/**
 * Message Item Component
 */
function MessageItem({ message }: { message: LLMMessage }) {
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
          <div className={`${typography.monoSm} text-gray-400`}>
            {formatTimestamp(message.timestamp)}
          </div>
        </div>
        <div className={`whitespace-pre-wrap ${typography.body}`}>{message.content}</div>
      </div>
    </div>
  );
}

/**
 * Tool Item Component with Modal Dialog
 */
function ToolItem({ tool }: { tool: ToolExecution }) {
  const [open, setOpen] = useState(false);
  const colors = roleColors.tool;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className={`w-full flex gap-3 ${radius.md} ${padding.card} ${colors.bg} border ${colors.border} hover:border-gray-300 hover:bg-white ${transitions.colors} ${focus.ring} text-left`}
        >
          <div className="flex-shrink-0">
            <Wrench size={20} className={colors.icon} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={typography.caption}>{tool.isComplete ? '●' : '○'}</span>
              <span className={`${typography.mono} text-gray-900 font-medium`}>{tool.name}</span>
              <span className={`${typography.monoSm} text-gray-400 ml-auto`}>
                {formatTimestamp(tool.timestamp)}
              </span>
              {!tool.isComplete && (
                <span className={`${typography.caption} text-gray-500`}>running...</span>
              )}
            </div>
            <div className={`${typography.caption} text-gray-600 truncate`}>
              {getToolSummary(tool.name, tool.args)}
            </div>
          </div>
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={`fixed left-1/2 top-1/2 z-50 w-full max-w-2xl max-h-[85vh] -translate-x-1/2 -translate-y-1/2 ${radius.md} border bg-white ${padding.panel} shadow-lg overflow-y-auto data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]`}
        >
          <Dialog.Title className={`${typography.label} text-lg mb-4 flex items-center gap-2`}>
            <Wrench size={20} className="text-gray-500" />
            <span className={typography.mono}>{tool.name}</span>
          </Dialog.Title>

          <Dialog.Description className="sr-only">
            Details of the {tool.name} tool execution
          </Dialog.Description>

          <div className={spacing.controls}>
            {/* Status */}
            <div className={`flex items-center gap-2 ${typography.body}`}>
              <span className="text-gray-500">Status:</span>
              <span
                className={`font-medium ${tool.isComplete ? 'text-green-600' : 'text-yellow-600'}`}
              >
                {tool.isComplete ? 'Complete' : 'Running'}
              </span>
            </div>

            {/* Parameters */}
            <div>
              <h3 className={`${typography.label} mb-2`}>Parameters</h3>
              {renderToolParameters(tool.name, tool.args)}
            </div>

            {/* Result */}
            {tool.isComplete && tool.result && (
              <div>
                <h3 className={`${typography.label} mb-2`}>Result</h3>
                <pre
                  className={`bg-gray-50 p-3 ${radius.sm} border border-gray-200 overflow-x-auto ${typography.mono} max-h-96 overflow-y-auto text-gray-800`}
                >
                  {tool.result}
                </pre>
              </div>
            )}
          </div>

          <Dialog.Close asChild>
            <button
              type="button"
              className={`absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white ${transitions.colors} hover:opacity-100 ${focus.ring} disabled:pointer-events-none`}
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Get a one-line summary of tool parameters
 */
function getToolSummary(toolName: string, args: Record<string, unknown> | undefined): string {
  if (!args) return 'Loading...';

  switch (toolName) {
    case 'writeFile': {
      const { path } = args as { path?: string };
      return `Writing to ${path || 'unknown'}`;
    }
    case 'readFile': {
      const { path } = args as { path?: string };
      return `Reading ${path || 'unknown'}`;
    }
    case 'listFiles': {
      const { directory } = args as { directory?: string };
      return `Listing ${directory || '.'}`;
    }
    case 'executeCommand': {
      const { command } = args as { command?: string };
      return command || 'unknown command';
    }
    default:
      return 'Click for details';
  }
}

/**
 * Render tool parameters with custom formatting
 */
function renderToolParameters(
  toolName: string,
  args: Record<string, unknown> | undefined,
): React.ReactNode {
  if (!args) {
    return <div className={`${typography.body} text-gray-400`}>No parameters</div>;
  }

  // Custom formatting for writeFile
  if (toolName === 'writeFile') {
    const { path, content } = args as { path?: string; content?: string };
    return (
      <div className={`${typography.body} ${spacing.form}`}>
        {path && (
          <div>
            <span className="text-gray-500">path:</span>
            <span className={`${typography.mono} text-gray-900 ml-2`}>{path}</span>
          </div>
        )}
        {content && (
          <div>
            <div className="text-gray-500 mb-1">content:</div>
            <pre
              className={`bg-gray-50 p-3 ${radius.sm} border border-gray-200 overflow-x-auto ${typography.mono} max-h-64 overflow-y-auto text-gray-800`}
            >
              {content}
            </pre>
          </div>
        )}
      </div>
    );
  }

  // Custom formatting for readFile
  if (toolName === 'readFile') {
    const { path } = args as { path?: string };
    return (
      <div className={typography.body}>
        <span className="text-gray-500">path:</span>
        <span className={`${typography.mono} text-gray-900 ml-2`}>{path || 'unknown'}</span>
      </div>
    );
  }

  // Custom formatting for listFiles
  if (toolName === 'listFiles') {
    const { directory } = args as { directory?: string };
    return (
      <div className={typography.body}>
        <span className="text-gray-500">directory:</span>
        <span className={`${typography.mono} text-gray-900 ml-2`}>{directory || '.'}</span>
      </div>
    );
  }

  // Custom formatting for executeCommand
  if (toolName === 'executeCommand') {
    const { command } = args as { command?: string };
    return (
      <div className={typography.body}>
        <div className="text-gray-500 mb-1">command:</div>
        <pre
          className={`bg-gray-50 p-3 ${radius.sm} border border-gray-200 overflow-x-auto ${typography.mono} text-gray-800`}
        >
          {command || 'unknown'}
        </pre>
      </div>
    );
  }

  // Default: show raw JSON
  return (
    <pre
      className={`bg-gray-50 p-3 ${radius.sm} border border-gray-200 overflow-x-auto ${typography.mono} text-gray-800`}
    >
      {JSON.stringify(args, null, 2)}
    </pre>
  );
}
