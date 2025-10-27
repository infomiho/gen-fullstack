import React from 'react';

/**
 * useCountUp: Animated counter hook
 *
 * Animates a number from 0 to target value over specified duration
 * Useful for statistics displays and achievement screens
 *
 * @param end - Target number to count up to
 * @param duration - Animation duration in milliseconds (default: 1000ms)
 * @returns Current count value
 *
 * @example
 * const count = useCountUp(42, 1500);
 * return <div>{count}</div>; // Animates from 0 to 42 over 1.5 seconds
 */
export function useCountUp(end: number, duration: number = 1000): number {
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    // Reset count to 0 when dependencies change
    setCount(0);

    let startTime: number | undefined;
    let animationFrame: number | undefined;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      setCount(Math.floor(progress * end));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame !== undefined) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [end, duration]);

  return count;
}
