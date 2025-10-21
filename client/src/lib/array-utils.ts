/**
 * Array Utilities
 *
 * Shared array manipulation utilities for store implementations.
 */

/**
 * Truncate an array to a maximum length by removing items from the beginning.
 *
 * This function mutates the array in place using splice(0, count), which is
 * efficient for Immer draft state in Zustand stores.
 *
 * @param array - Array to truncate (will be mutated)
 * @param maxLength - Maximum allowed length
 * @returns Object with truncation info { truncated: boolean, count: number }
 *
 * @example
 * ```typescript
 * const items = [1, 2, 3, 4, 5];
 * const result = truncateArray(items, 3);
 * // items is now [3, 4, 5]
 * // result is { truncated: true, count: 2 }
 * ```
 */
export function truncateArray<T>(
  array: T[],
  maxLength: number,
): { truncated: boolean; count: number } {
  if (array.length <= maxLength) {
    return { truncated: false, count: 0 };
  }

  const count = array.length - maxLength;
  array.splice(0, count);
  return { truncated: true, count };
}
