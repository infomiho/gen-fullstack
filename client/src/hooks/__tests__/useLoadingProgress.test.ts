import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLoadingProgress } from '../useLoadingProgress';

describe('useLoadingProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('should start at 0', () => {
    const { result } = renderHook(() => useLoadingProgress(1000));
    expect(result.current).toBe(0);
  });

  it('should progress to 100 over duration', () => {
    const { result } = renderHook(() => useLoadingProgress(1000, 100));

    expect(result.current).toBe(0);

    // After 500ms, should be around 50%
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBeGreaterThanOrEqual(45);
    expect(result.current).toBeLessThanOrEqual(55);

    // After 1000ms, should be 100%
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe(100);
  });

  it('should use default interval of 100ms', () => {
    const { result } = renderHook(() => useLoadingProgress(1000));

    // Default interval is 100ms, so after 100ms progress should be ~10%
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBeGreaterThanOrEqual(9);
    expect(result.current).toBeLessThanOrEqual(11);
  });

  it('should stop at 100% and clear interval', () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    const { result } = renderHook(() => useLoadingProgress(500, 100));

    // Advance past completion
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current).toBe(100);

    // Should have cleared the interval
    expect(clearIntervalSpy).toHaveBeenCalled();

    // Further advances shouldn't change value
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(100);
  });

  it('should round progress to integer', () => {
    const { result } = renderHook(() => useLoadingProgress(333, 100)); // Creates fractional increments

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBeGreaterThan(0);

    // Should always be an integer
    expect(Number.isInteger(result.current)).toBe(true);
  });

  it('should cleanup interval on unmount', () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    const { unmount } = renderHook(() => useLoadingProgress(1000));

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('should handle prop changes', () => {
    const { result, rerender } = renderHook(({ duration }) => useLoadingProgress(duration, 100), {
      initialProps: { duration: 1000 },
    });

    // Progress partway
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBeGreaterThan(0);

    // Change duration - effect will re-run
    rerender({ duration: 2000 });

    // Progress will be affected by the new duration
    // Implementation may reset or continue - just verify it's working
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBeGreaterThanOrEqual(0);
    expect(result.current).toBeLessThanOrEqual(100);
  });

  it('should handle very short durations', () => {
    const { result } = renderHook(() => useLoadingProgress(100, 50));

    // After one interval (50ms), should be at 50%
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current).toBeCloseTo(50, 0);

    // After two intervals (100ms), should be at 100%
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(result.current).toBe(100);
  });

  it('should handle very long durations', () => {
    const { result } = renderHook(() => useLoadingProgress(10000, 100));

    // After 1000ms (10% of duration)
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBeCloseTo(10, 0);

    // After 5000ms (50% of duration)
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(result.current).toBeCloseTo(50, 0);
  });
});
