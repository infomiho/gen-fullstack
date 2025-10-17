import { useCallback, useRef } from 'react';

/**
 * Custom hook for debounced notifications
 *
 * Prevents notification spam by enforcing a minimum time between notifications.
 * Useful for connection errors, truncation warnings, etc.
 *
 * @param callback - The notification function to debounce
 * @param debounceMs - Minimum milliseconds between notifications
 * @returns Debounced notification function
 */
export function useDebouncedNotification(
  callback: (...args: unknown[]) => void,
  debounceMs: number,
): (...args: unknown[]) => void {
  const lastNotificationTime = useRef<number>(0);

  return useCallback(
    (...args: unknown[]) => {
      const now = Date.now();
      const timeSinceLastNotification = now - lastNotificationTime.current;

      if (timeSinceLastNotification > debounceMs) {
        callback(...args);
        lastNotificationTime.current = now;
      }
    },
    [callback, debounceMs],
  );
}
