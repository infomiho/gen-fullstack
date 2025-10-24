import { Loader2 } from 'lucide-react';
import { padding, radius, typography } from '../../lib/design-tokens';

/**
 * SkeletonLoader Component
 *
 * Displays an animated loading indicator to show ongoing generation.
 * Shows when the generation status is "generating".
 */
export function SkeletonLoader() {
  return (
    <div
      className={`${radius.md} ${padding.card} border border-border bg-card flex items-center justify-center gap-3`}
      data-testid="skeleton-loader"
    >
      <Loader2 size={20} className="text-muted-foreground animate-spin" />
      <span className={`${typography.body} text-muted-foreground`}>Generating...</span>
    </div>
  );
}
