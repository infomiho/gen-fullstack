import { useEffect, useState } from 'react';

/**
 * Hook to animate a loading progress bar from 0 to 100%
 *
 * @param durationMs - Total duration in milliseconds
 * @param intervalMs - Update interval in milliseconds (default: 100ms)
 * @returns Current progress percentage (0-100)
 *
 * @example
 * ```ts
 * const progress = useLoadingProgress(2000); // Animates from 0 to 100 over 2 seconds
 * ```
 */
export function useLoadingProgress(durationMs: number, intervalMs = 100): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const increment = (100 / durationMs) * intervalMs;

    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + increment;
        if (next >= 100) {
          clearInterval(interval);
          return 100;
        }
        return next;
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [durationMs, intervalMs]);

  return Math.round(progress);
}
