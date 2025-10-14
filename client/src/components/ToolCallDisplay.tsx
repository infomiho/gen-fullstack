import type { ToolCall, ToolResult } from '@gen-fullstack/shared';
import { useMemo } from 'react';

interface ToolCallDisplayProps {
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
}

interface MergedToolExecution {
  id: string;
  name: string;
  args: Record<string, unknown> | undefined;
  result?: string;
  isComplete: boolean;
}

/**
 * ToolCallDisplay Component
 *
 * Displays tool calls and their results in a unified view.
 * Each tool execution is shown in a single card that updates from "calling" to "complete" state.
 */
export function ToolCallDisplay({ toolCalls, toolResults }: ToolCallDisplayProps) {
  // Merge tool calls with their results by matching IDs
  const mergedExecutions = useMemo(() => {
    const executions: MergedToolExecution[] = [];

    // Create a map of results by tool call ID
    const resultsMap = new Map<string, ToolResult>();
    toolResults.forEach((result) => {
      // Result ID format is "result-{toolCallId}"
      const toolCallId = result.id.replace('result-', '');
      resultsMap.set(toolCallId, result);
    });

    // Merge tool calls with their results
    toolCalls.forEach((toolCall) => {
      const result = resultsMap.get(toolCall.id);
      executions.push({
        id: toolCall.id,
        name: toolCall.name,
        args: toolCall.args,
        result: result?.result,
        isComplete: !!result,
      });
    });

    return executions;
  }, [toolCalls, toolResults]);

  if (mergedExecutions.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <div className="text-4xl mb-2">🔧</div>
        <div className="text-sm">No tool executions yet</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b pb-3">
        <h3 className="text-lg font-semibold text-gray-800">Tool Executions</h3>
        <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
          {mergedExecutions.length} {mergedExecutions.length === 1 ? 'call' : 'calls'}
        </span>
      </div>

      <div className="space-y-3">
        {mergedExecutions.map((execution) => (
          <div
            key={execution.id}
            className={`rounded-lg p-4 border-l-4 shadow-sm transition-all ${
              execution.isComplete
                ? 'bg-green-50 border-green-500'
                : 'bg-blue-50 border-blue-500 animate-pulse'
            }`}
          >
            {/* Header */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{execution.isComplete ? '✅' : '⏳'}</span>
              <span
                className={`font-mono text-sm font-bold ${
                  execution.isComplete ? 'text-green-900' : 'text-blue-900'
                }`}
              >
                {execution.name}
              </span>
              {!execution.isComplete && (
                <span className="text-xs text-blue-600 italic ml-auto">executing...</span>
              )}
            </div>

            {/* Custom formatted parameters */}
            {renderToolParameters(execution.name, execution.args, execution.isComplete)}

            {/* Result (only shown when complete) */}
            {execution.isComplete && execution.result && (
              <div className="mt-3 pt-3 border-t border-green-200">
                <div className="text-xs font-semibold text-gray-600 mb-2">Result:</div>
                <pre className="bg-white p-3 rounded border border-green-200 overflow-x-auto text-xs max-h-48 overflow-y-auto">
                  {truncate(execution.result, 800)}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Render tool parameters with custom formatting based on tool type
 */
function renderToolParameters(
  toolName: string,
  args: Record<string, unknown> | undefined,
  isComplete: boolean,
): JSX.Element {
  const borderColor = isComplete ? 'border-green-100' : 'border-blue-100';

  // Handle undefined args
  if (!args) {
    return (
      <div className="text-sm">
        <span className="text-gray-500 italic">Loading parameters...</span>
      </div>
    );
  }

  // Custom formatting for writeFile
  if (toolName === 'writeFile') {
    const { path, content } = args as { path?: string; content?: string };
    return (
      <div className="text-sm space-y-2">
        {path && (
          <div className="flex items-start gap-2">
            <span className="text-xs font-semibold text-gray-600 min-w-[60px]">File:</span>
            <span className="font-mono text-xs bg-white px-2 py-1 rounded border border-gray-200 flex-1">
              {path}
            </span>
          </div>
        )}
        {content && (
          <div>
            <div className="text-xs font-semibold text-gray-600 mb-1">Content:</div>
            <pre
              className={`bg-white p-3 rounded border ${borderColor} overflow-x-auto text-xs max-h-40 overflow-y-auto`}
            >
              {truncate(content, 500)}
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
      <div className="text-sm flex items-start gap-2">
        <span className="text-xs font-semibold text-gray-600 min-w-[60px]">File:</span>
        <span className="font-mono text-xs bg-white px-2 py-1 rounded border border-gray-200 flex-1">
          {path || 'unknown'}
        </span>
      </div>
    );
  }

  // Custom formatting for listFiles
  if (toolName === 'listFiles') {
    const { directory } = args as { directory?: string };
    return (
      <div className="text-sm flex items-start gap-2">
        <span className="text-xs font-semibold text-gray-600 min-w-[60px]">Directory:</span>
        <span className="font-mono text-xs bg-white px-2 py-1 rounded border border-gray-200 flex-1">
          {directory || '.'}
        </span>
      </div>
    );
  }

  // Custom formatting for executeCommand
  if (toolName === 'executeCommand') {
    const { command } = args as { command?: string };
    return (
      <div className="text-sm">
        <div className="text-xs font-semibold text-gray-600 mb-1">Command:</div>
        <pre
          className={`bg-white p-3 rounded border ${borderColor} overflow-x-auto text-xs font-mono`}
        >
          {command || 'unknown'}
        </pre>
      </div>
    );
  }

  // Default: show raw JSON for unknown tools
  return (
    <div className="text-sm">
      <div className="text-xs font-semibold text-gray-600 mb-1">Parameters:</div>
      <pre className={`bg-white p-3 rounded border ${borderColor} overflow-x-auto text-xs`}>
        {JSON.stringify(args, null, 2)}
      </pre>
    </div>
  );
}

/**
 * Truncate long strings for display
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  const truncated = str.slice(0, maxLength);
  const lastNewline = truncated.lastIndexOf('\n');
  // Try to truncate at a line boundary for cleaner display
  const cutPoint = lastNewline > maxLength * 0.8 ? lastNewline : maxLength;
  return str.slice(0, cutPoint) + '\n\n... (truncated, ' + (str.length - cutPoint) + ' more characters)';
}
