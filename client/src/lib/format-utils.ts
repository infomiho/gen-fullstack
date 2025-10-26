import type { CapabilityConfig } from '@gen-fullstack/shared';

/**
 * Format utilities for session list display
 *
 * Provides consistent formatting for:
 * - Duration (milliseconds → "2m 34s")
 * - Token counts (15234 → "15.2k")
 * - Relative timestamps ("37m ago", "2h ago")
 * - Capability config parsing
 */

// Time conversion constants
const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;

// Token formatting constants
const TOKEN_COMPACT_THRESHOLD = 1000;
const TOKEN_DECIMAL_PLACES = 1;

// Relative time constants
const MS_PER_MINUTE = 60000;
const MS_PER_HOUR = 3600000;
const MS_PER_DAY = 86400000;

/**
 * Format duration in milliseconds to human-readable string
 * Examples:
 * - 5000 → "5s"
 * - 65000 → "1m 5s"
 * - 154000 → "2m 34s"
 * - 3661000 → "1h 1m"
 */
export function formatDuration(ms: number | undefined): string {
  if (!ms || ms < 0) return '0s';

  const seconds = Math.floor(ms / MS_PER_SECOND);
  const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);

  if (hours > 0) {
    const remainingMinutes = minutes % MINUTES_PER_HOUR;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  if (minutes > 0) {
    const remainingSeconds = seconds % SECONDS_PER_MINUTE;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  return `${seconds}s`;
}

/**
 * Format token count to compact string
 * Examples:
 * - 234 → "234"
 * - 1234 → "1.2k"
 * - 15234 → "15.2k"
 * - 123456 → "123.5k"
 */
export function formatTokens(count: number | undefined): string {
  if (!count || count < 0) return '0';

  if (count < TOKEN_COMPACT_THRESHOLD) {
    return count.toString();
  }

  return `${(count / TOKEN_COMPACT_THRESHOLD).toFixed(TOKEN_DECIMAL_PLACES)}k`;
}

/**
 * Format timestamp to relative time string
 * Examples:
 * - < 1 min ago → "Just now"
 * - < 1 hour ago → "37m ago"
 * - < 24 hours ago → "2h ago"
 * - < 7 days ago → "3d ago"
 * - >= 7 days → "Jan 26, 2025"
 */
export function formatRelativeTime(dateString: string | undefined | null): string {
  // Handle null/undefined
  if (!dateString) return 'Unknown';

  const date = new Date(dateString);

  // Validate date (handle invalid date strings)
  if (Number.isNaN(date.getTime())) {
    // biome-ignore lint/suspicious/noConsole: Useful for debugging invalid date formats
    console.warn(`Invalid date string: ${dateString}`);
    return 'Unknown';
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  // Handle future dates (clock skew, etc.)
  if (diffMs < 0) {
    return 'Just now';
  }

  const diffMins = Math.floor(diffMs / MS_PER_MINUTE);
  const diffHours = Math.floor(diffMs / MS_PER_HOUR);
  const diffDays = Math.floor(diffMs / MS_PER_DAY);

  if (diffMins < 1) return 'Just now';
  if (diffMins < MINUTES_PER_HOUR) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * Parse capability config JSON string to typed object
 * Returns null if parsing fails
 */
export function parseCapabilityConfig(jsonString: string): CapabilityConfig | null {
  try {
    return JSON.parse(jsonString) as CapabilityConfig;
  } catch {
    return null;
  }
}

/**
 * Get list of active capability keys (excluding inputMode)
 * Returns empty array if no optional capabilities are enabled
 * Examples:
 * - { inputMode: 'naive', planning: true, compilerChecks: true } → ['planning', 'compilerChecks']
 * - { inputMode: 'template', planning: false } → []
 */
export function getActiveCapabilities(
  config: CapabilityConfig | null,
): Array<'planning' | 'compilerChecks' | 'buildingBlocks'> {
  if (!config) return [];

  const active: Array<'planning' | 'compilerChecks' | 'buildingBlocks'> = [];

  if (config.planning) active.push('planning');
  if (config.compilerChecks) active.push('compilerChecks');
  if (config.buildingBlocks) active.push('buildingBlocks');

  return active;
}

/**
 * Get human-readable input mode label
 */
export function getInputModeLabel(inputMode: 'naive' | 'template'): string {
  return inputMode === 'naive' ? 'Naive' : 'Template';
}
