import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLocalStorageDraft } from './useLocalStorageDraft';

describe('useLocalStorageDraft', () => {
  const TEST_KEY = 'test-draft-key';

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('should initialize with empty string when no saved draft exists', () => {
    const { result } = renderHook(() => useLocalStorageDraft(TEST_KEY));

    const [value] = result.current;
    expect(value).toBe('');
  });

  it('should restore draft from localStorage on mount', () => {
    localStorage.setItem(TEST_KEY, 'Saved draft text');

    const { result } = renderHook(() => useLocalStorageDraft(TEST_KEY));

    const [value] = result.current;
    expect(value).toBe('Saved draft text');
  });

  it('should save to localStorage after debounce delay', () => {
    const { result } = renderHook(() => useLocalStorageDraft(TEST_KEY, 500));

    act(() => {
      const [, setValue] = result.current;
      setValue('New draft text');
    });

    // Before debounce - should not be saved yet
    expect(localStorage.getItem(TEST_KEY)).toBeNull();

    // Advance timers by debounce delay
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // After debounce - should be saved
    expect(localStorage.getItem(TEST_KEY)).toBe('New draft text');
  });

  it('should debounce multiple rapid updates', () => {
    const { result } = renderHook(() => useLocalStorageDraft(TEST_KEY, 500));

    act(() => {
      const [, setValue] = result.current;

      // Make multiple rapid updates
      setValue('Draft 1');
      vi.advanceTimersByTime(100);

      setValue('Draft 2');
      vi.advanceTimersByTime(100);

      setValue('Draft 3');
      vi.advanceTimersByTime(100);
    });

    // Still no save (only 300ms passed)
    expect(localStorage.getItem(TEST_KEY)).toBeNull();

    // Advance past debounce delay from last update
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Should save only the last value
    expect(localStorage.getItem(TEST_KEY)).toBe('Draft 3');
  });

  it('should remove from localStorage when value is empty', () => {
    localStorage.setItem(TEST_KEY, 'Initial draft');

    const { result } = renderHook(() => useLocalStorageDraft(TEST_KEY, 500));

    act(() => {
      const [, setValue] = result.current;
      setValue('');
    });

    // Advance timers
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Should be removed from localStorage
    expect(localStorage.getItem(TEST_KEY)).toBeNull();
  });

  it('should clear draft immediately when clearDraft is called', () => {
    localStorage.setItem(TEST_KEY, 'Draft to clear');

    const { result } = renderHook(() => useLocalStorageDraft(TEST_KEY));

    const [initialValue, , clearDraft] = result.current;
    expect(initialValue).toBe('Draft to clear');

    // Clear draft
    act(() => {
      clearDraft();
    });

    // Should immediately clear state
    const [clearedValue] = result.current;
    expect(clearedValue).toBe('');

    // Should immediately remove from localStorage (no debounce)
    expect(localStorage.getItem(TEST_KEY)).toBeNull();
  });

  it('should handle localStorage errors gracefully on restore', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('localStorage is full');
    });

    const { result } = renderHook(() => useLocalStorageDraft(TEST_KEY));

    const [value] = result.current;
    expect(value).toBe(''); // Should fallback to empty string
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to restore draft from localStorage:',
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();
    getItemSpy.mockRestore();
  });

  it('should handle localStorage errors gracefully on save', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('localStorage is full');
    });

    const { result } = renderHook(() => useLocalStorageDraft(TEST_KEY, 500));

    act(() => {
      const [, setValue] = result.current;
      setValue('New draft');
    });

    // Advance timers
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Should log error but not crash
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to save draft to localStorage:',
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();
    setItemSpy.mockRestore();
  });

  it('should handle localStorage errors gracefully on clear', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('localStorage error');
    });

    const { result } = renderHook(() => useLocalStorageDraft(TEST_KEY));

    act(() => {
      const [, , clearDraft] = result.current;
      clearDraft();
    });

    // Should log error but not crash
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to clear draft from localStorage:',
      expect.any(Error),
    );

    consoleErrorSpy.mockRestore();
    removeItemSpy.mockRestore();
  });

  it('should use custom debounce delay', () => {
    const { result } = renderHook(() => useLocalStorageDraft(TEST_KEY, 1000));

    act(() => {
      const [, setValue] = result.current;
      setValue('Draft with custom delay');
    });

    // After 500ms - should not be saved yet
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(localStorage.getItem(TEST_KEY)).toBeNull();

    // After 1000ms - should be saved
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(localStorage.getItem(TEST_KEY)).toBe('Draft with custom delay');
  });

  it('should cleanup timeout on unmount', () => {
    const { result, unmount } = renderHook(() => useLocalStorageDraft(TEST_KEY, 500));

    act(() => {
      const [, setValue] = result.current;
      setValue('Draft before unmount');
    });

    // Unmount before debounce completes
    unmount();

    // Advance timers
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Should not save after unmount
    expect(localStorage.getItem(TEST_KEY)).toBeNull();
  });

  it('should maintain separate state for different keys', () => {
    const KEY1 = 'draft-key-1';
    const KEY2 = 'draft-key-2';

    localStorage.setItem(KEY1, 'Draft 1');
    localStorage.setItem(KEY2, 'Draft 2');

    const { result: result1 } = renderHook(() => useLocalStorageDraft(KEY1));
    const { result: result2 } = renderHook(() => useLocalStorageDraft(KEY2));

    const [value1] = result1.current;
    const [value2] = result2.current;

    expect(value1).toBe('Draft 1');
    expect(value2).toBe('Draft 2');

    // Update first hook
    act(() => {
      const [, setValue1] = result1.current;
      setValue1('Updated 1');
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Only KEY1 should be updated
    expect(localStorage.getItem(KEY1)).toBe('Updated 1');
    expect(localStorage.getItem(KEY2)).toBe('Draft 2');
  });
});
