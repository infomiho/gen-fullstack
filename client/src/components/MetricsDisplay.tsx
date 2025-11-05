import { MODEL_METADATA, type ModelId } from '@gen-fullstack/shared';

interface MetricsDisplayProps {
  model?: string;
  totalTokens: number;
  cost: string;
  durationMs: number;
  stepCount: number;
}

/**
 * Get display name for a model ID
 */
function getModelDisplayName(modelId?: string): string {
  if (!modelId) {
    return 'Unknown';
  }

  // Check if it's a valid model ID
  if (modelId in MODEL_METADATA) {
    return MODEL_METADATA[modelId as ModelId].label;
  }

  // Fallback: capitalize and format the model ID
  return modelId
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * MetricsDisplay component
 *
 * Displays generation metrics for a completed session:
 * - Model used (if available)
 * - Total tokens used
 * - Cost in dollars
 * - Duration in seconds
 * - Number of steps
 */
export function MetricsDisplay({
  model,
  totalTokens,
  cost,
  durationMs,
  stepCount,
}: MetricsDisplayProps) {
  return (
    <div className="space-y-2.5 text-sm">
      {model && (
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Model</span>
          <span className="font-mono text-foreground font-medium">
            {getModelDisplayName(model)}
          </span>
        </div>
      )}
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
