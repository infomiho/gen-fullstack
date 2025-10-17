import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedNotification } from './useDebouncedNotification';

describe('useDebouncedNotification', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should call the callback immediately on first invocation', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedNotification(callback, 30000));

    result.current('arg1', 'arg2');

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('should debounce calls within the time window', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedNotification(callback, 30000));

    // First call
    result.current('first');
    expect(callback).toHaveBeenCalledTimes(1);

    // Advance time by 10 seconds (less than 30-second window)
    vi.advanceTimersByTime(10000);

    // Second call (should be debounced)
    result.current('second');
    expect(callback).toHaveBeenCalledTimes(1); // Still only 1 call

    // Advance time by another 10 seconds (total 20 seconds)
    vi.advanceTimersByTime(10000);

    // Third call (should still be debounced)
    result.current('third');
    expect(callback).toHaveBeenCalledTimes(1); // Still only 1 call
  });

  it('should allow call after debounce window expires', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedNotification(callback, 30000));

    // First call
    result.current('first');
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenLastCalledWith('first');

    // Advance time past debounce window (31 seconds)
    vi.advanceTimersByTime(31000);

    // Second call (should go through)
    result.current('second');
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenLastCalledWith('second');
  });

  it('should handle rapid calls with different debounce windows', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedNotification(callback, 5000));

    // Simulate 10 rapid calls over 10 seconds
    for (let i = 0; i < 10; i++) {
      result.current(`call-${i}`);
      vi.advanceTimersByTime(1000); // 1 second between calls
    }

    // With a 5-second window (requires > 5000ms, not >= 5000ms):
    // - Call 0: Goes through (t=0, first call)
    // - Calls 1-5: Debounced (t=1-5, time since last <= 5000ms)
    // - Call 6: Goes through (t=6, 6000ms since last > 5000ms)
    // - Calls 7-9: Debounced (t=7-9, within window)
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenNthCalledWith(1, 'call-0');
    expect(callback).toHaveBeenNthCalledWith(2, 'call-6');
  });

  it('should maintain separate debounce state across multiple hook instances', () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    const { result: result1 } = renderHook(() => useDebouncedNotification(callback1, 30000));
    const { result: result2 } = renderHook(() => useDebouncedNotification(callback2, 30000));

    // First hook - first call
    result1.current('hook1-call1');
    expect(callback1).toHaveBeenCalledTimes(1);

    // Second hook - first call (should also go through immediately)
    result2.current('hook2-call1');
    expect(callback2).toHaveBeenCalledTimes(1);

    // Advance time within window
    vi.advanceTimersByTime(10000);

    // First hook - second call (should be debounced)
    result1.current('hook1-call2');
    expect(callback1).toHaveBeenCalledTimes(1); // Still only 1

    // Second hook - second call (should be debounced)
    result2.current('hook2-call2');
    expect(callback2).toHaveBeenCalledTimes(1); // Still only 1
  });
});
