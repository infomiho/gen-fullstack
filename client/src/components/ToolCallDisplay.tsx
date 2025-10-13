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
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">
        Tool Executions ({mergedExecutions.length})
      </h3>

      <div className="space-y-2">
        {mergedExecutions.map((execution) => (
          <div
            key={execution.id}
            className={`rounded-lg p-3 border ${
              execution.isComplete ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'
            }`}
          >
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{execution.isComplete ? '✅' : '⏳'}</span>
              <span
                className={`font-mono font-semibold ${
                  execution.isComplete ? 'text-green-900' : 'text-blue-900'
                }`}
              >
                {execution.name}
              </span>
              {!execution.isComplete && (
                <span className="text-xs text-blue-600 italic">calling...</span>
              )}
            </div>

            {/* Custom formatted parameters */}
            {renderToolParameters(execution.name, execution.args, execution.isComplete)}

            {/* Result (only shown when complete) */}
            {execution.isComplete && execution.result && (
              <div className="text-sm">
                <div className="text-gray-600 mb-1">Result:</div>
                <pre className="bg-white p-2 rounded border border-green-100 overflow-x-auto text-xs max-h-40">
                  {truncate(execution.result, 500)}
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
          <div>
            <span className="text-gray-600">File: </span>
            <span className="font-mono text-xs bg-white px-2 py-1 rounded border border-gray-200">
              {path}
            </span>
          </div>
        )}
        {content && (
          <div>
            <div className="text-gray-600 mb-1">Content:</div>
            <pre
              className={`bg-white p-2 rounded border ${borderColor} overflow-x-auto text-xs max-h-32`}
            >
              {truncate(content, 300)}
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
      <div className="text-sm">
        <span className="text-gray-600">File: </span>
        <span className="font-mono text-xs bg-white px-2 py-1 rounded border border-gray-200">
          {path || 'unknown'}
        </span>
      </div>
    );
  }

  // Custom formatting for listFiles
  if (toolName === 'listFiles') {
    const { directory } = args as { directory?: string };
    return (
      <div className="text-sm">
        <span className="text-gray-600">Directory: </span>
        <span className="font-mono text-xs bg-white px-2 py-1 rounded border border-gray-200">
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
        <div className="text-gray-600 mb-1">Command:</div>
        <pre
          className={`bg-white p-2 rounded border ${borderColor} overflow-x-auto text-xs font-mono`}
        >
          {command || 'unknown'}
        </pre>
      </div>
    );
  }

  // Default: show raw JSON for unknown tools
  return (
    <div className="text-sm">
      <div className="text-gray-600 mb-1">Parameters:</div>
      <pre className={`bg-white p-2 rounded border ${borderColor} overflow-x-auto text-xs`}>
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
  return str.slice(0, maxLength) + '\n\n... (truncated)';
}
