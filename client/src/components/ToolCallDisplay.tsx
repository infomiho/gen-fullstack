import type { ToolCall, ToolResult } from '@gen-fullstack/shared';
import { useMemo } from 'react';

interface ToolCallDisplayProps {
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
}

interface MergedToolExecution {
  id: string;
  name: string;
  args: Record<string, unknown>;
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
    return null;
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
              execution.isComplete
                ? 'bg-green-50 border-green-200'
                : 'bg-blue-50 border-blue-200'
            }`}
          >
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">
                {execution.isComplete ? '✅' : '⏳'}
              </span>
              <span className={`font-mono font-semibold ${
                execution.isComplete ? 'text-green-900' : 'text-blue-900'
              }`}>
                {execution.name}
              </span>
              {!execution.isComplete && (
                <span className="text-xs text-blue-600 italic">calling...</span>
              )}
            </div>

            {/* Parameters */}
            <div className="text-sm mb-2">
              <div className="text-gray-600 mb-1">Parameters:</div>
              <pre className={`bg-white p-2 rounded border overflow-x-auto text-xs ${
                execution.isComplete ? 'border-green-100' : 'border-blue-100'
              }`}>
                {JSON.stringify(execution.args, null, 2)}
              </pre>
            </div>

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
 * Truncate long strings for display
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength) + '\n\n... (truncated)';
}
