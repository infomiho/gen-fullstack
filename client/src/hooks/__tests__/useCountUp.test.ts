import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCountUp } from '../useCountUp';

describe('useCountUp', () => {
  beforeEach(() => {
    // Setup fake timers with rAF/cAF support
    vi.useFakeTimers({
      toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // Helper function to advance animation frames
  const advanceFrames = (count: number) => {
    for (let i = 0; i < count; i++) {
      vi.advanceTimersToNextFrame();
    }
  };

  it('should start at 0', () => {
    const { result } = renderHook(() => useCountUp(100, 1000));
    expect(result.current).toBe(0);
  });

  it('should count up to target value', () => {
    const { result } = renderHook(() => useCountUp(100, 100));

    // Initial state
    expect(result.current).toBe(0);

    // Advance halfway through animation (~3 frames = ~48ms of 100ms)
    act(() => {
      advanceFrames(3);
    });
    expect(result.current).toBeGreaterThan(0);
    expect(result.current).toBeLessThan(100);

    // Complete animation (~7 frames = ~112ms total, ensures completion)
    act(() => {
      advanceFrames(7);
    });
    expect(result.current).toBe(100);
  });

  it('should respect custom duration', () => {
    const { result } = renderHook(() => useCountUp(50, 200));

    // Initial state
    expect(result.current).toBe(0);

    // Advance halfway (~6 frames = ~96ms of 200ms)
    act(() => {
      advanceFrames(6);
    });
    expect(result.current).toBeGreaterThan(0);
    expect(result.current).toBeLessThan(50);

    // Complete animation (~14 frames total = ~224ms, ensures completion)
    act(() => {
      advanceFrames(14);
    });
    expect(result.current).toBe(50);
  });

  it('should use default duration of 1000ms', () => {
    const { result } = renderHook(() => useCountUp(42, 100));

    // Initial state
    expect(result.current).toBe(0);

    // Advance halfway (~3 frames = ~48ms of 100ms)
    act(() => {
      advanceFrames(3);
    });
    expect(result.current).toBeGreaterThan(0);
    expect(result.current).toBeLessThan(42);

    // Complete animation (~7 frames total = ~112ms, ensures completion)
    act(() => {
      advanceFrames(7);
    });
    expect(result.current).toBe(42);
  });

  it('should handle end value of 0', () => {
    const { result } = renderHook(() => useCountUp(0, 100));
    expect(result.current).toBe(0);

    // Should stay at 0 even after animation time
    act(() => {
      advanceFrames(10);
    });
    expect(result.current).toBe(0);
  });

  it('should handle negative end values', () => {
    const { result } = renderHook(() => useCountUp(-100, 100));

    // Initial state
    expect(result.current).toBe(0);

    // Advance halfway (~3 frames = ~48ms of 100ms)
    act(() => {
      advanceFrames(3);
    });
    expect(result.current).toBeLessThan(0);
    expect(result.current).toBeGreaterThan(-100);

    // Complete animation (~7 frames total = ~112ms, ensures completion)
    act(() => {
      advanceFrames(7);
    });
    expect(result.current).toBe(-100);
  });

  it('should cleanup animation frame on unmount', () => {
    const cancelAnimationFrameSpy = vi.spyOn(window, 'cancelAnimationFrame');

    const { unmount } = renderHook(() => useCountUp(100, 1000));

    unmount();

    expect(cancelAnimationFrameSpy).toHaveBeenCalled();
  });

  it('should restart animation when end value changes', () => {
    const { result, rerender } = renderHook(({ end }) => useCountUp(end, 100), {
      initialProps: { end: 50 },
    });

    // Initial state
    expect(result.current).toBe(0);

    // Advance animation (~3 frames)
    act(() => {
      advanceFrames(3);
    });
    expect(result.current).toBeGreaterThan(0);

    // Change target - should restart from 0
    act(() => {
      rerender({ end: 100 });
    });

    // Should restart from 0
    expect(result.current).toBe(0);

    // Advance to new target (~8 frames to ensure completion after rerender)
    act(() => {
      advanceFrames(8);
    });
    expect(result.current).toBe(100);
  });

  it('should restart animation when duration changes', () => {
    const { result, rerender } = renderHook(({ end, duration }) => useCountUp(end, duration), {
      initialProps: { end: 100, duration: 100 },
    });

    // Initial state
    expect(result.current).toBe(0);

    // Advance animation (~3 frames)
    act(() => {
      advanceFrames(3);
    });
    expect(result.current).toBeGreaterThan(0);

    // Change duration - should restart from 0
    act(() => {
      rerender({ end: 100, duration: 200 });
    });

    // Should restart from 0
    expect(result.current).toBe(0);

    // Advance with new duration (~14 frames for 200ms)
    act(() => {
      advanceFrames(14);
    });
    expect(result.current).toBe(100);
  });

  it('should floor fractional values', () => {
    const { result } = renderHook(() => useCountUp(99, 200));

    // Initial state
    expect(result.current).toBe(0);

    // Advance to a point where flooring matters (~5 frames = ~80ms of 200ms)
    act(() => {
      advanceFrames(5);
    });

    // Should be between 0 and 99
    expect(result.current).toBeGreaterThan(0);
    expect(result.current).toBeLessThan(99);

    // Verify flooring behavior: value should be an integer
    expect(Number.isInteger(result.current)).toBe(true);

    // Complete animation (~14 frames total = ~224ms)
    act(() => {
      advanceFrames(14);
    });
    expect(result.current).toBe(99);
  });
});
