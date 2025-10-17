/**
 * Log formatting utilities
 *
 * Utilities for formatting and displaying logs from app execution.
 */

import type { AppLog } from '@gen-fullstack/shared';

/**
 * Get Tailwind color classes for a log level
 *
 * @param level - Log level (info, warn, error, command)
 * @returns Tailwind color class string
 *
 * @example
 * getLevelColor('error') // "text-red-600"
 * getLevelColor('command') // "text-purple-400"
 * getLevelColor('info') // "text-blue-600"
 */
export function getLevelColor(level: AppLog['level']): string {
  switch (level) {
    case 'error':
      return 'text-red-600';
    case 'warn':
      return 'text-yellow-600';
    case 'command':
      return 'text-purple-400';
    default:
      return 'text-blue-600';
  }
}

/**
 * Get display label for a log level
 *
 * @param level - Log level
 * @returns Display label string
 *
 * @example
 * getLevelLabel('error') // "ERROR"
 * getLevelLabel('command') // "CMD"
 * getLevelLabel('info') // "INFO"
 */
export function getLevelLabel(level: AppLog['level']): string {
  switch (level) {
    case 'error':
      return 'ERROR';
    case 'warn':
      return 'WARN';
    case 'command':
      return 'CMD';
    default:
      return 'INFO';
  }
}

/**
 * Filter logs by level and search text
 *
 * @param logs - Array of logs to filter
 * @param levelFilter - Filter by level (null = all levels)
 * @param searchText - Filter by text content (case-insensitive)
 * @returns Filtered log array
 *
 * @example
 * filterLogs(logs, 'error', 'failed') // Only error logs containing "failed"
 * filterLogs(logs, null, 'npm') // All logs containing "npm"
 */
export function filterLogs(
  logs: AppLog[],
  levelFilter: AppLog['level'] | null,
  searchText: string,
): AppLog[] {
  return logs.filter((log) => {
    const matchesLevel = levelFilter === null || log.level === levelFilter;
    const matchesSearch =
      searchText === '' || log.message.toLowerCase().includes(searchText.toLowerCase());
    return matchesLevel && matchesSearch;
  });
}
