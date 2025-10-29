import { padding, radius } from '../../lib/design-tokens';

/**
 * SkeletonLoader Component
 *
 * Displays a subtle three-dots animated loading indicator to show ongoing generation.
 * Shows when the generation status is "generating".
 */
export function SkeletonLoader() {
  return (
    <div
      className={`${radius.md} ${padding.card} border border-border bg-card flex items-center justify-center`}
      data-testid="skeleton-loader"
    >
      <div className="inline-flex gap-2">
        <span
          className="animate-pulse-dot text-3xl text-muted-foreground leading-none"
          style={{ animationDelay: '0ms' }}
        >
          •
        </span>
        <span
          className="animate-pulse-dot text-3xl text-muted-foreground leading-none"
          style={{ animationDelay: '150ms' }}
        >
          •
        </span>
        <span
          className="animate-pulse-dot text-3xl text-muted-foreground leading-none"
          style={{ animationDelay: '300ms' }}
        >
          •
        </span>
      </div>
      <style>{`
        @keyframes pulse-dot {
          0%, 80%, 100% {
            opacity: 0.3;
          }
          40% {
            opacity: 1;
          }
        }
        .animate-pulse-dot {
          animation: pulse-dot 1.4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
