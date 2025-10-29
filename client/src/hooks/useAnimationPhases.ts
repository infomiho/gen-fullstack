import { useEffect, useState } from 'react';

/**
 * Animation phase configuration
 */
interface PhaseConfig<T extends string> {
  /** Phase identifier */
  phase: T;
  /** Duration in milliseconds (0 for initial phase) */
  duration: number;
}

/**
 * Hook to manage multi-phase animations with automatic transitions
 *
 * Handles sequential animation phases with automatic transitions based on durations.
 * Cleans up timers on unmount.
 *
 * @param phases - Array of phase configurations (first phase starts immediately)
 * @returns Current active phase
 *
 * @example
 * ```ts
 * const phase = useAnimationPhases([
 *   { phase: 'loading', duration: 0 },     // Start immediately
 *   { phase: 'ready', duration: 2000 },    // After 2 seconds
 *   { phase: 'fight', duration: 500 },     // After 2.5 seconds total
 * ]);
 * ```
 */
export function useAnimationPhases<T extends string>(phases: Array<PhaseConfig<T>>): T {
  const [currentPhase, setCurrentPhase] = useState<T>(phases[0]?.phase);

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];
    let cumulativeDuration = 0;

    // Schedule all phase transitions
    for (let i = 1; i < phases.length; i++) {
      cumulativeDuration += phases[i - 1].duration;
      const nextPhase = phases[i].phase;

      const timer = setTimeout(() => {
        setCurrentPhase(nextPhase);
      }, cumulativeDuration);

      timers.push(timer);
    }

    // Cleanup all timers on unmount
    return () => {
      timers.forEach(clearTimeout);
    };
  }, [phases]);

  return currentPhase;
}
