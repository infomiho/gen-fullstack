import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Custom hook for managing draft text with debounced localStorage persistence
 *
 * Restores draft from localStorage on mount and saves changes with debouncing
 * to avoid excessive writes. Useful for preserving user input across page reloads.
 *
 * @param key - localStorage key to use for persistence
 * @param debounceMs - Milliseconds to wait before saving to localStorage (default: 500)
 * @returns Tuple of [value, setValue, clearDraft]
 *
 * @example
 * const [prompt, setPrompt, clearPrompt] = useLocalStorageDraft('gen-fullstack:draft-prompt');
 */
export function useLocalStorageDraft(
  key: string,
  debounceMs = 500,
): [string, (value: string) => void, () => void] {
  const [value, setValue] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ?? '';
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: Useful for debugging localStorage failures
      console.error('Failed to restore draft from localStorage:', error);
      return '';
    }
  });

  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      try {
        if (value) {
          localStorage.setItem(key, value);
        } else {
          localStorage.removeItem(key);
        }
      } catch (error) {
        // biome-ignore lint/suspicious/noConsole: Useful for debugging localStorage failures
        console.error('Failed to save draft to localStorage:', error);
      }
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [key, value, debounceMs]);

  const clearDraft = useCallback(() => {
    setValue('');
    try {
      localStorage.removeItem(key);
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: Useful for debugging localStorage failures
      console.error('Failed to clear draft from localStorage:', error);
    }
  }, [key]);

  return [value, setValue, clearDraft];
}
