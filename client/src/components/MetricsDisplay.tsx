interface MetricsDisplayProps {
  totalTokens: number;
  cost: string;
  durationMs: number;
  stepCount: number;
}

/**
 * MetricsDisplay component
 *
 * Displays generation metrics for a completed session:
 * - Total tokens used
 * - Cost in dollars
 * - Duration in seconds
 * - Number of steps
 */
export function MetricsDisplay({ totalTokens, cost, durationMs, stepCount }: MetricsDisplayProps) {
  return (
    <div className="space-y-2.5 text-sm">
      <div className="flex justify-between items-center">
        <span className="text-gray-600">Tokens</span>
        <span className="font-mono text-gray-900 font-medium">{totalTokens.toLocaleString()}</span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-gray-600">Cost</span>
        <span className="font-mono text-gray-900 font-medium">
          ${Number.parseFloat(cost || '0').toFixed(4)}
        </span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-gray-600">Duration</span>
        <span className="font-mono text-gray-900 font-medium">
          {(durationMs / 1000).toFixed(1)}s
        </span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-gray-600">Steps</span>
        <span className="font-mono text-gray-900 font-medium">{stepCount}</span>
      </div>
    </div>
  );
}
