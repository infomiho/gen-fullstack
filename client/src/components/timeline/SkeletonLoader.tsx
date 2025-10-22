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
      className={`${radius.md} ${padding.card} border border-gray-200 bg-white flex items-center justify-center gap-3`}
      data-testid="skeleton-loader"
    >
      <Loader2 size={20} className="text-gray-400 animate-spin" />
      <span className={`${typography.body} text-gray-500`}>Generating...</span>
    </div>
  );
}
