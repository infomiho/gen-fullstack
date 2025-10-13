interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

interface ToolResult {
  toolName: string;
  result: string;
}

interface ToolCallDisplayProps {
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
}

/**
 * ToolCallDisplay Component
 *
 * Displays tool calls and their results in a formatted, easy-to-read manner.
 * Shows which tools the LLM is calling and what they return.
 */
export function ToolCallDisplay({ toolCalls, toolResults }: ToolCallDisplayProps) {
  if (toolCalls.length === 0 && toolResults.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">
        Tool Calls ({toolCalls.length})
      </h3>

      {/* Tool Calls */}
      {toolCalls.length > 0 && (
        <div className="space-y-2">
          {toolCalls.map((toolCall, index) => (
            <div
              key={index}
              className="bg-blue-50 border border-blue-200 rounded-lg p-3"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🔧</span>
                <span className="font-mono font-semibold text-blue-900">
                  {toolCall.name}
                </span>
              </div>
              <div className="text-sm">
                <div className="text-gray-600 mb-1">Parameters:</div>
                <pre className="bg-white p-2 rounded border border-blue-100 overflow-x-auto text-xs">
                  {JSON.stringify(toolCall.args, null, 2)}
                </pre>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tool Results */}
      {toolResults.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-md font-semibold text-gray-600">Results</h4>
          {toolResults.map((result, index) => (
            <div
              key={index}
              className="bg-green-50 border border-green-200 rounded-lg p-3"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">✅</span>
                <span className="font-mono font-semibold text-green-900">
                  {result.toolName}
                </span>
              </div>
              <div className="text-sm">
                <div className="text-gray-600 mb-1">Result:</div>
                <pre className="bg-white p-2 rounded border border-green-100 overflow-x-auto text-xs max-h-40">
                  {truncate(result.result, 500)}
                </pre>
              </div>
            </div>
          ))}
        </div>
      )}
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
