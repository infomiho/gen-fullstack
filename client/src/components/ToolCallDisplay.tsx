import type { ToolCall, ToolResult } from '@gen-fullstack/shared';
import { useMemo } from 'react';
import { EmptyState } from './EmptyState';
import { renderToolParameters } from '../lib/tool-utils';
import { Wrench } from 'lucide-react';

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
      <EmptyState
        icon={<Wrench size={48} />}
        title="No tool calls yet"
        description="Tool executions will appear here during generation"
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pb-2">
        <h3 className="text-sm font-medium text-gray-700">Tool Executions</h3>
        <span className="text-xs text-gray-500">{mergedExecutions.length}</span>
      </div>

      <div className="space-y-2">
        {mergedExecutions.map((execution) => (
          <div
            key={execution.id}
            className={`border rounded p-3 ${
              execution.isComplete ? 'border-gray-200 bg-white' : 'border-gray-300 bg-gray-50'
            }`}
          >
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm">{execution.isComplete ? '●' : '○'}</span>
              <span className="font-mono text-xs text-gray-900">{execution.name}</span>
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
                  {truncateResult(execution.result, 800)}
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
 * Tries to truncate at line boundaries for cleaner display
 */
function truncateResult(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  const truncated = str.slice(0, maxLength);
  const lastNewline = truncated.lastIndexOf('\n');
  // Try to truncate at a line boundary for cleaner display
  const cutPoint = lastNewline > maxLength * 0.8 ? lastNewline : maxLength;
  return `${str.slice(0, cutPoint)}\n\n... (truncated, ${str.length - cutPoint} more characters)`;
}
