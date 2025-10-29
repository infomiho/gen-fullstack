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
      <svg
        viewBox="0 0 60 20"
        xmlns="http://www.w3.org/2000/svg"
        className="w-12 h-5"
        style={{ display: 'inline-block' }}
        aria-label="Loading"
      >
        <title>Loading</title>
        <circle
          cx="10"
          cy="10"
          r="4"
          className="animate-pulse-dot text-muted-foreground"
          style={{
            animationDelay: '0ms',
            fill: 'currentColor',
          }}
        />
        <circle
          cx="30"
          cy="10"
          r="4"
          className="animate-pulse-dot text-muted-foreground"
          style={{
            animationDelay: '150ms',
            fill: 'currentColor',
          }}
        />
        <circle
          cx="50"
          cy="10"
          r="4"
          className="animate-pulse-dot text-muted-foreground"
          style={{
            animationDelay: '300ms',
            fill: 'currentColor',
          }}
        />
      </svg>
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
