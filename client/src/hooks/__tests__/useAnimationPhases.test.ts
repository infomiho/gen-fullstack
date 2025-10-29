import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnimationPhases } from '../useAnimationPhases';

describe('useAnimationPhases', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('should start with first phase', () => {
    const phases = [
      { phase: 'loading' as const, duration: 0 },
      { phase: 'ready' as const, duration: 1000 },
      { phase: 'fight' as const, duration: 500 },
    ];

    const { result } = renderHook(() => useAnimationPhases(phases));

    expect(result.current).toBe('loading');
  });

  it('should transition to next phase after duration', () => {
    const phases = [
      { phase: 'loading' as const, duration: 0 },
      { phase: 'ready' as const, duration: 1000 },
      { phase: 'fight' as const, duration: 500 },
    ];

    const { result } = renderHook(() => useAnimationPhases(phases));

    expect(result.current).toBe('loading');

    // Advance past first duration (0ms, should be immediate)
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('ready');

    // Advance past second duration (1000ms)
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe('fight');
  });

  it('should calculate cumulative durations correctly', () => {
    const phases = [
      { phase: 'phase1' as const, duration: 100 },
      { phase: 'phase2' as const, duration: 200 },
      { phase: 'phase3' as const, duration: 300 },
    ];

    const { result } = renderHook(() => useAnimationPhases(phases));

    expect(result.current).toBe('phase1');

    // Phase 1 → Phase 2 after 100ms
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe('phase2');

    // Phase 2 → Phase 3 after 200ms more (300ms total)
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe('phase3');
  });

  it('should cleanup timers on unmount', () => {
    const phases = [
      { phase: 'phase1' as const, duration: 1000 },
      { phase: 'phase2' as const, duration: 1000 },
      { phase: 'phase3' as const, duration: 1000 },
    ];

    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    const { unmount } = renderHook(() => useAnimationPhases(phases));

    unmount();

    // Should clear 2 timers (transitions from phase1→2 and phase2→3)
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(2);
  });

  it('should handle single phase', () => {
    const phases = [{ phase: 'only' as const, duration: 1000 }];

    const { result } = renderHook(() => useAnimationPhases(phases));

    expect(result.current).toBe('only');

    // Should stay on single phase
    vi.advanceTimersByTime(2000);
    expect(result.current).toBe('only');
  });

  it('should handle phase changes when props update', () => {
    type AllPhases = 'phase1' | 'phase2' | 'newPhase1' | 'newPhase2';

    const initialPhases: Array<{ phase: AllPhases; duration: number }> = [
      { phase: 'phase1', duration: 100 },
      { phase: 'phase2', duration: 100 },
    ];

    const newPhases: Array<{ phase: AllPhases; duration: number }> = [
      { phase: 'newPhase1', duration: 50 },
      { phase: 'newPhase2', duration: 50 },
    ];

    const { result, rerender } = renderHook(({ phases }) => useAnimationPhases(phases), {
      initialProps: { phases: initialPhases },
    });

    expect(result.current).toBe('phase1');

    // Rerender with new phases - effect will re-run and start from first phase
    rerender({ phases: newPhases });

    // After rerender, should be on first phase (implementation-dependent)
    // The hook restarts the animation with new phases
    act(() => {
      vi.advanceTimersByTime(50);
    });
    // After advancing, should have transitioned
    expect(['newPhase1', 'newPhase2']).toContain(result.current);
  });

  it('should handle very short duration phases', () => {
    const phases = [
      { phase: 'phase1' as const, duration: 1 },
      { phase: 'phase2' as const, duration: 1 },
      { phase: 'phase3' as const, duration: 100 },
    ];

    const { result } = renderHook(() => useAnimationPhases(phases));

    expect(result.current).toBe('phase1');

    // Advance through short durations
    act(() => {
      vi.advanceTimersByTime(2);
    });
    // Should have progressed
    expect(['phase2', 'phase3']).toContain(result.current);
  });
});
