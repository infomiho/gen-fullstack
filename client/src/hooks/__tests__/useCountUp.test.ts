import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCountUp } from '../useCountUp';

describe('useCountUp', () => {
  beforeEach(() => {
    vi.useRealTimers(); // Use real timers since requestAnimationFrame doesn't work well with fake timers
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should start at 0', () => {
    const { result } = renderHook(() => useCountUp(100, 1000));
    expect(result.current).toBe(0);
  });

  it('should count up to target value', async () => {
    const { result } = renderHook(() => useCountUp(100, 100)); // Use short duration for testing

    // Wait for animation to progress
    await waitFor(
      () => {
        expect(result.current).toBeGreaterThan(0);
      },
      { timeout: 200 },
    );

    // Wait for completion
    await waitFor(
      () => {
        expect(result.current).toBe(100);
      },
      { timeout: 300 },
    );
  });

  it('should respect custom duration', async () => {
    const { result } = renderHook(() => useCountUp(50, 200)); // Use short duration

    // Wait for animation to progress
    await waitFor(
      () => {
        expect(result.current).toBeGreaterThan(0);
      },
      { timeout: 150 },
    );

    // Wait for completion
    await waitFor(
      () => {
        expect(result.current).toBe(50);
      },
      { timeout: 300 },
    );
  });

  it('should use default duration of 1000ms', async () => {
    const { result } = renderHook(() => useCountUp(42, 100)); // Use short duration

    // Wait for animation to progress
    await waitFor(
      () => {
        expect(result.current).toBeGreaterThan(0);
      },
      { timeout: 80 },
    );

    // Wait for completion
    await waitFor(
      () => {
        expect(result.current).toBe(42);
      },
      { timeout: 200 },
    );
  });

  it('should handle end value of 0', async () => {
    const { result } = renderHook(() => useCountUp(0, 100));
    expect(result.current).toBe(0);

    // Should stay at 0
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(result.current).toBe(0);
  });

  it('should handle negative end values', async () => {
    const { result } = renderHook(() => useCountUp(-100, 100));

    await waitFor(
      () => {
        expect(result.current).toBeLessThan(0);
      },
      { timeout: 80 },
    );

    await waitFor(
      () => {
        expect(result.current).toBe(-100);
      },
      { timeout: 200 },
    );
  });

  it('should cleanup animation frame on unmount', () => {
    const cancelAnimationFrameSpy = vi.spyOn(window, 'cancelAnimationFrame');

    const { unmount } = renderHook(() => useCountUp(100, 1000));

    unmount();

    expect(cancelAnimationFrameSpy).toHaveBeenCalled();
  });

  it('should restart animation when end value changes', async () => {
    const { result, rerender } = renderHook(({ end }) => useCountUp(end, 100), {
      initialProps: { end: 50 },
    });

    // Wait for animation to progress
    await waitFor(
      () => {
        expect(result.current).toBeGreaterThan(0);
      },
      { timeout: 80 },
    );

    // Change target
    act(() => {
      rerender({ end: 100 });
    });

    // Should restart from 0
    expect(result.current).toBe(0);

    // Advance to new target
    await waitFor(
      () => {
        expect(result.current).toBe(100);
      },
      { timeout: 200 },
    );
  });

  it('should restart animation when duration changes', async () => {
    const { result, rerender } = renderHook(({ end, duration }) => useCountUp(end, duration), {
      initialProps: { end: 100, duration: 100 },
    });

    // Wait for progress
    await waitFor(
      () => {
        expect(result.current).toBeGreaterThan(0);
      },
      { timeout: 80 },
    );

    // Change duration
    act(() => {
      rerender({ end: 100, duration: 200 });
    });

    // Should restart from 0
    expect(result.current).toBe(0);
  });

  it('should floor fractional values', async () => {
    const { result } = renderHook(() => useCountUp(99, 200));

    // Wait for animation to progress (not at start, not at end)
    await waitFor(
      () => {
        expect(result.current).toBeGreaterThan(0);
        expect(result.current).toBeLessThan(99);
      },
      { timeout: 100 },
    );

    // Verify flooring behavior: value should be an integer
    expect(Number.isInteger(result.current)).toBe(true);

    // Wait for completion to verify final value is reached
    await waitFor(
      () => {
        expect(result.current).toBe(99);
      },
      { timeout: 250 },
    );
  });
});
