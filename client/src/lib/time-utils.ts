/**
 * Time formatting utilities
 *
 * Centralized time formatting functions for consistent display across the app.
 */

/**
 * Format a timestamp to HH:MM:SS.mmm format
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted time string
 *
 * @example
 * formatTimestamp(1704196800000) // "00:00:00.000"
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  const ms = date.getMilliseconds().toString().padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${ms}`;
}

/**
 * Format a Date object to HH:MM:SS format (without milliseconds)
 *
 * @param date - Date object to format
 * @returns Formatted time string
 *
 * @example
 * formatTime(new Date()) // "14:32:15"
 */
export function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Get relative time string from timestamp
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Relative time string like "2s ago" or "5m ago"
 *
 * @example
 * getRelativeTime(Date.now() - 5000) // "5s ago"
 * getRelativeTime(Date.now() - 120000) // "2m ago"
 */
export function getRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) {
    return `${seconds}s ago`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
