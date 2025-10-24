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
        <span className="text-muted-foreground">Tokens</span>
        <span className="font-mono text-foreground font-medium">
          {totalTokens.toLocaleString()}
        </span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-muted-foreground">Cost</span>
        <span className="font-mono text-foreground font-medium">
          ${Number.parseFloat(cost || '0').toFixed(4)}
        </span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-muted-foreground">Duration</span>
        <span className="font-mono text-foreground font-medium">
          {(durationMs / 1000).toFixed(1)}s
        </span>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-muted-foreground">Steps</span>
        <span className="font-mono text-foreground font-medium">{stepCount}</span>
      </div>
    </div>
  );
}
