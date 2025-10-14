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
      <div className="text-center py-12 text-gray-400 text-sm">
        No tool calls yet
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pb-2">
        <h3 className="text-sm font-medium text-gray-700">Tool Executions</h3>
        <span className="text-xs text-gray-500">
          {mergedExecutions.length}
        </span>
      </div>

      <div className="space-y-2">
        {mergedExecutions.map((execution) => (
          <div
            key={execution.id}
            className={`border rounded p-3 ${
              execution.isComplete
                ? 'border-gray-200 bg-white'
                : 'border-gray-300 bg-gray-50'
            }`}
          >
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm">{execution.isComplete ? '●' : '○'}</span>
              <span className="font-mono text-xs text-gray-900">
                {execution.name}
              </span>
              {!execution.isComplete && (
                <span className="text-xs text-gray-500 ml-auto">running</span>
              )}
            </div>

            {/* Custom formatted parameters */}
            {renderToolParameters(execution.name, execution.args)}

            {/* Result (only shown when complete) */}
            {execution.isComplete && execution.result && (
              <div className="mt-2 pt-2 border-t border-gray-100">
                <div className="text-xs text-gray-500 mb-1">Result:</div>
                <pre className="bg-gray-50 p-2 rounded border border-gray-200 overflow-x-auto text-xs max-h-48 overflow-y-auto font-mono">
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
) {
  // Handle undefined args
  if (!args) {
    return (
      <div className="text-xs text-gray-400">
        Loading...
      </div>
    );
  }

  // Custom formatting for writeFile
  if (toolName === 'writeFile') {
    const { path, content } = args as { path?: string; content?: string };
    return (
      <div className="text-xs space-y-1.5">
        {path && (
          <div className="flex gap-2">
            <span className="text-gray-500 min-w-[40px]">path:</span>
            <span className="font-mono text-gray-700 flex-1">
              {path}
            </span>
          </div>
        )}
        {content && (
          <div>
            <div className="text-gray-500 mb-1">content:</div>
            <pre className="bg-gray-50 p-2 rounded border border-gray-200 overflow-x-auto text-xs max-h-32 overflow-y-auto font-mono text-gray-700">
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
      <div className="text-xs flex gap-2">
        <span className="text-gray-500 min-w-[40px]">path:</span>
        <span className="font-mono text-gray-700">
          {path || 'unknown'}
        </span>
      </div>
    );
  }

  // Custom formatting for listFiles
  if (toolName === 'listFiles') {
    const { directory } = args as { directory?: string };
    return (
      <div className="text-xs flex gap-2">
        <span className="text-gray-500 min-w-[40px]">dir:</span>
        <span className="font-mono text-gray-700">
          {directory || '.'}
        </span>
      </div>
    );
  }

  // Custom formatting for executeCommand
  if (toolName === 'executeCommand') {
    const { command } = args as { command?: string };
    return (
      <div className="text-xs">
        <div className="text-gray-500 mb-1">command:</div>
        <pre className="bg-gray-50 p-2 rounded border border-gray-200 overflow-x-auto text-xs font-mono text-gray-700">
          {command || 'unknown'}
        </pre>
      </div>
    );
  }

  // Default: show raw JSON for unknown tools
  return (
    <div className="text-xs">
      <pre className="bg-gray-50 p-2 rounded border border-gray-200 overflow-x-auto font-mono text-gray-700">
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
